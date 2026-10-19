using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-070..073: the stock race endpoint runs the "never oversell" claim on demand and
/// reports a verdict computed from the persisted product.
/// </summary>
public class StockRaceTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client;

    public StockRaceTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    private sealed record RaceBuyer(int Buyer, string Outcome, string? Code, int Attempts);

    private sealed record RaceResult(
        int Units, int Buyers, int Sold, int Rejected, int Remaining, bool Balanced,
        IReadOnlyList<RaceBuyer> Results);

    [Fact]
    public async Task A_race_never_sells_more_units_than_exist_and_balances_to_the_unit()
    {
        var response = await _client.PostAsJsonAsync("/api/demo/stock-race", new { buyers = 24, units = 5 }, Json);

        response.EnsureSuccessStatusCode();
        var race = (await response.Content.ReadFromJsonAsync<RaceResult>(Json))!;

        Assert.Equal(24, race.Results.Count);
        Assert.Equal(5, race.Units);
        Assert.Equal(5, race.Sold);
        Assert.Equal(19, race.Rejected);
        Assert.Equal(0, race.Remaining);
        Assert.True(race.Balanced);
        Assert.Equal(race.Sold, race.Results.Count(r => r.Outcome == "won"));
        // After retrying conflicts, the only final reason to turn a buyer away is that the stock ran out.
        Assert.All(race.Results.Where(r => r.Outcome == "rejected"), r => Assert.Equal("insufficient_stock", r.Code));
    }

    [Fact]
    public async Task A_race_with_more_units_than_buyers_sells_to_everyone()
    {
        var response = await _client.PostAsJsonAsync("/api/demo/stock-race", new { buyers = 4, units = 10 }, Json);

        response.EnsureSuccessStatusCode();
        var race = (await response.Content.ReadFromJsonAsync<RaceResult>(Json))!;

        Assert.Equal(4, race.Sold);
        Assert.Equal(0, race.Rejected);
        Assert.Equal(6, race.Remaining);
        Assert.True(race.Balanced);
    }

    [Theory]
    [InlineData(1, 5)]
    [InlineData(65, 5)]
    [InlineData(10, 0)]
    [InlineData(10, 33)]
    public async Task A_race_outside_the_allowed_range_is_rejected_with_400(int buyers, int units)
    {
        var response = await _client.PostAsJsonAsync("/api/demo/stock-race", new { buyers, units }, Json);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync());
    }
}
