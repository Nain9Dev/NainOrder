using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NainOrder.Application.DTOs;

namespace NainOrder.Tests.Api;

/// <summary>A clock the test moves by hand, so hold expiry is exercised without sleeping.</summary>
public sealed class TestClock : TimeProvider
{
    private DateTimeOffset _now = DateTimeOffset.UtcNow;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

/// <summary>REQ-080 to REQ-086 and REQ-088 over HTTP, on the real application.</summary>
public class DropFlowTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly TestClock _clock = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public DropFlowTests(NainOrderApiFactory factory)
    {
        _factory = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(_clock);
        }));
        _client = _factory.CreateClient();
    }

    private async Task<Guid> CreateProductAsync() =>
        (await (await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest($"NO-DROP-{Guid.NewGuid():N}"[..20], "Limited sneaker", 129.90m, 1), Json))
            .Content.ReadFromJsonAsync<ProductDto>(Json))!.Id;

    private async Task<DropDto> CreateDropAsync(int units, int perBuyer = 1, int holdSeconds = 60, int opensInSeconds = 0)
    {
        var response = await _client.PostAsJsonAsync("/api/drops", new
        {
            productId = await CreateProductAsync(),
            totalUnits = units,
            perBuyerLimit = perBuyer,
            holdSeconds,
            opensInSeconds
        }, Json);

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DropDto>(Json))!;
    }

    private static HttpRequestMessage Post(string url, string buyer, object? body = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body ?? new { }, options: Json) };
        request.Headers.Add("X-Buyer-Token", buyer);
        return request;
    }

    private async Task<HttpResponseMessage> TakeAsync(Guid dropId, string buyer, int quantity = 1) =>
        await _client.SendAsync(Post($"/api/drops/{dropId}/holds", buyer, new { quantity }));

    private async Task<DropDto> GetAsync(Guid dropId, string? buyer = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/drops/{dropId}");
        if (buyer is not null) request.Headers.Add("X-Buyer-Token", buyer);
        return (await (await _client.SendAsync(request)).Content.ReadFromJsonAsync<DropDto>(Json))!;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("code").GetString();

    [Fact]
    public async Task A_new_drop_reports_its_units_and_goes_live()
    {
        var drop = await CreateDropAsync(units: 8, perBuyer: 2);

        Assert.Equal("Live", drop.Status);
        Assert.Equal(8, drop.TotalUnits);
        Assert.Equal(8, drop.Available);
        Assert.Equal(0, drop.Held + drop.Sold);
    }

    [Fact]
    public async Task A_scheduled_drop_rejects_takes_until_it_opens()
    {
        var drop = await CreateDropAsync(units: 5, opensInSeconds: 120);

        var early = await TakeAsync(drop.Id, "buyer-a");
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("drop_not_live", await CodeOf(early));

        _clock.Advance(TimeSpan.FromSeconds(121));
        Assert.Equal(HttpStatusCode.OK, (await TakeAsync(drop.Id, "buyer-a")).StatusCode);
    }

    [Fact]
    public async Task Taking_and_confirming_turns_a_hold_into_a_paid_order()
    {
        var drop = await CreateDropAsync(units: 5, perBuyer: 2);

        var take = await TakeAsync(drop.Id, "buyer-a", 2);
        var hold = (await take.Content.ReadFromJsonAsync<HoldDto>(Json))!;

        var confirm = await _client.SendAsync(Post($"/api/drops/{drop.Id}/holds/{hold.Id}/confirm", "buyer-a"));
        confirm.EnsureSuccessStatusCode();
        var order = (await confirm.Content.ReadFromJsonAsync<OrderDto>(Json))!;

        Assert.Equal("Paid", order.Status);
        Assert.Equal(2, order.TotalUnits);
        Assert.Equal(259.80m, order.TotalAmount);

        var after = await GetAsync(drop.Id, "buyer-a");
        Assert.Equal(2, after.Sold);
        Assert.Equal(3, after.Available);
    }

    [Fact]
    public async Task A_buyer_over_the_limit_is_rejected_with_409()
    {
        var drop = await CreateDropAsync(units: 5, perBuyer: 1);
        await TakeAsync(drop.Id, "buyer-a");

        var second = await TakeAsync(drop.Id, "buyer-a");

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("buyer_limit_reached", await CodeOf(second));
    }

    [Fact]
    public async Task An_unconfirmed_hold_expires_and_returns_its_units()
    {
        var drop = await CreateDropAsync(units: 2, perBuyer: 2, holdSeconds: 30);
        var hold = (await (await TakeAsync(drop.Id, "buyer-a", 2)).Content.ReadFromJsonAsync<HoldDto>(Json))!;
        Assert.Equal("SoldOut", (await GetAsync(drop.Id)).Status);

        _clock.Advance(TimeSpan.FromSeconds(31));

        var after = await GetAsync(drop.Id);
        Assert.Equal("Live", after.Status);
        Assert.Equal(2, after.Available);

        var late = await _client.SendAsync(Post($"/api/drops/{drop.Id}/holds/{hold.Id}/confirm", "buyer-a"));
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("hold_expired", await CodeOf(late));
    }

    [Fact]
    public async Task Sweeping_persists_the_expiry_of_due_holds()
    {
        var drop = await CreateDropAsync(units: 3, perBuyer: 3, holdSeconds: 30);
        await TakeAsync(drop.Id, "buyer-a", 2);
        _clock.Advance(TimeSpan.FromSeconds(31));

        // The background sweeper may get there first; either way the hold must end up Expired.
        using (var scope = _factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<NainOrder.Application.Interfaces.IDropService>().ExpireDueHoldsAsync();

        var after = await GetAsync(drop.Id, "buyer-a");
        Assert.Equal("Expired", Assert.Single(after.MyHolds).State);
        Assert.Equal(3, after.Available);
    }

    [Fact]
    public async Task A_hold_of_another_buyer_cannot_be_confirmed()
    {
        var drop = await CreateDropAsync(units: 3);
        var hold = (await (await TakeAsync(drop.Id, "buyer-a")).Content.ReadFromJsonAsync<HoldDto>(Json))!;

        var stolen = await _client.SendAsync(Post($"/api/drops/{drop.Id}/holds/{hold.Id}/confirm", "buyer-b"));

        Assert.Equal(HttpStatusCode.NotFound, stolen.StatusCode);
        Assert.Equal("hold_not_found", await CodeOf(stolen));
    }

    [Fact]
    public async Task Taking_without_a_buyer_token_is_a_400()
    {
        var drop = await CreateDropAsync(units: 3);

        var response = await _client.PostAsJsonAsync($"/api/drops/{drop.Id}/holds", new { quantity = 1 }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>REQ-085 under a real crowd: 40 buyers, 10 units, conflicts retried like a client would.</summary>
    [Fact]
    public async Task A_crowd_never_holds_or_sells_more_units_than_the_drop_contains()
    {
        const int units = 10;
        const int buyers = 40;
        var drop = await CreateDropAsync(units, perBuyer: 1);
        var startGun = new TaskCompletionSource();

        var attempts = Enumerable.Range(0, buyers).Select(index => Task.Run(async () =>
        {
            await startGun.Task;
            for (var attempt = 0; attempt < 60; attempt++)
            {
                var response = await TakeAsync(drop.Id, $"crowd-{index}");
                if (response.IsSuccessStatusCode) return "won";

                var code = await CodeOf(response);
                if (code != "concurrency_conflict") return code!;
            }

            return "gave_up";
        })).ToList();

        startGun.SetResult();
        var outcomes = await Task.WhenAll(attempts);

        var after = await GetAsync(drop.Id);
        Assert.Equal(units, outcomes.Count(o => o == "won"));
        Assert.All(outcomes.Where(o => o != "won"), o => Assert.Equal("insufficient_stock", o));
        Assert.Equal(units, after.Held + after.Sold);
        Assert.Equal(0, after.Available);
        Assert.Equal("SoldOut", after.Status);
    }

    [Theory]
    [InlineData(0, 1, 60)]
    [InlineData(5, 6, 60)]
    [InlineData(5, 1, 1)]
    public async Task An_invalid_drop_configuration_is_rejected_with_400(int units, int perBuyer, int holdSeconds)
    {
        var response = await _client.PostAsJsonAsync("/api/drops", new
        {
            productId = await CreateProductAsync(),
            totalUnits = units,
            perBuyerLimit = perBuyer,
            holdSeconds
        }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
