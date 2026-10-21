using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using NainOrder.Application.DTOs;
using NainOrder.Infrastructure.Persistence.Seeding;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-110 and REQ-111: the server states, in every response, what the panel's request map
/// shows — the real timings and, for a rejection, the layer that decided it. The map never
/// guesses; these tests are what make that claim hold.
/// </summary>
public class RequestObservabilityTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly Regex Metric = new(@"(?<name>\w+);dur=(?<dur>[\d.]+)(?:;desc=""(?<desc>[^""]*)"")?", RegexOptions.None, TimeSpan.FromSeconds(1));

    private readonly HttpClient _client;

    public RequestObservabilityTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    private static Dictionary<string, (double Duration, string? Description)> Timings(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Server-Timing", out var values), "Server-Timing header missing");

        return Metric.Matches(string.Join(",", values!))
            .ToDictionary(m => m.Groups["name"].Value,
                          m => (double.Parse(m.Groups["dur"].Value, System.Globalization.CultureInfo.InvariantCulture),
                                m.Groups["desc"].Success ? m.Groups["desc"].Value : null));
    }

    private static async Task<string?> LayerOf(HttpResponseMessage response)
    {
        Assert.Contains("problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        return problem.TryGetProperty("layer", out var layer) ? layer.GetString() : null;
    }

    [Fact]
    public async Task A_catalogue_read_reports_the_whole_request_and_its_database_time()
    {
        var response = await _client.GetAsync("/api/products");
        var timings = Timings(response);

        Assert.True(timings["app"].Duration >= 0);
        Assert.True(timings.ContainsKey("db"), "the catalogue read uses the database, so db must be reported");
        Assert.True(timings["db"].Duration >= 0);
        Assert.Matches(@"^\d+ commands?$", timings["db"].Description);
        Assert.True(timings["db"].Duration <= timings["app"].Duration + 1, "database time cannot exceed the whole request");
    }

    [Fact]
    public async Task The_read_side_that_runs_raw_sql_is_timed_too()
    {
        // The dashboard aggregates with ADO.NET commands that bypass EF Core's interceptors; the
        // header must still count them, or the map would show a database read as free.
        var response = await _client.GetAsync("/api/dashboard/stats");
        var timings = Timings(response);

        Assert.True(timings.ContainsKey("db"), "dashboard metrics are computed in the database");
        Assert.Matches(@"^[4-9] commands$", timings["db"].Description);
    }

    [Fact]
    public async Task A_read_that_never_touches_the_database_reports_no_db_segment()
    {
        var response = await _client.GetAsync("/api/meta/order-state-machine");
        var timings = Timings(response);

        Assert.True(timings.ContainsKey("app"));
        Assert.False(timings.ContainsKey("db"), "the state machine is published by the domain alone");
    }

    [Fact]
    public async Task A_domain_rule_names_the_domain_layer()
    {
        var product = await (await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest($"NO-OBS-{Guid.NewGuid():N}"[..20], "Scarce", 10m, 1), Json))
            .Content.ReadFromJsonAsync<ProductDto>(Json);
        var order = await (await _client.PostAsJsonAsync("/api/orders",
            new CreateOrderRequest(DatabaseSeeder.DemoCustomerId), Json))
            .Content.ReadFromJsonAsync<OrderDto>(Json);

        var response = await _client.PostAsJsonAsync($"/api/orders/{order!.Id}/items",
            new AddOrderItemRequest(product!.Id, 5), Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("domain", await LayerOf(response));
        Assert.True(Timings(response).ContainsKey("app"), "a rejection is timed like any other response");
    }

    [Fact]
    public async Task A_missing_resource_names_the_application_layer()
    {
        var response = await _client.GetAsync($"/api/orders/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application", await LayerOf(response));
    }

    [Fact]
    public async Task A_validation_failure_names_the_api_layer()
    {
        var response = await _client.PostAsJsonAsync("/api/orders", new { customerId = (string?)null }, Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("api", await LayerOf(response));
    }

    [Fact]
    public async Task An_unknown_route_names_the_api_layer()
    {
        var response = await _client.GetAsync("/api/nothing-here");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("api", await LayerOf(response));
    }
}
