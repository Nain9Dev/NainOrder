using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NainOrder.Application.DTOs;
using NainOrder.Infrastructure.Persistence.Seeding;

namespace NainOrder.Tests.Api;

/// <summary>Recorrido extremo a extremo del contrato HTTP, incluidos los caminos de error.</summary>
public class OrderFlowTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client;

    public OrderFlowTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    private async Task<ProductDto> FirstProductAsync()
    {
        var products = await _client.GetFromJsonAsync<List<ProductDto>>("/api/products", Json);
        return products!.First(product => product.StockQuantity > 3);
    }

    private async Task<OrderDto> NewOrderAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/orders",
            new CreateOrderRequest(DatabaseSeeder.DemoCustomerId), Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<OrderDto>(Json))!;
    }

    private async Task<int> StockOfAsync(Guid productId)
    {
        var product = await _client.GetFromJsonAsync<ProductDto>($"/api/products/{productId}", Json);
        return product!.StockQuantity;
    }

    private static async Task<(string Code, JsonElement Body)> ReadProblemAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("code").GetString()!, body);
    }

    [Fact]
    public async Task The_full_purchase_flow_moves_stock_and_state_together()
    {
        var product = await FirstProductAsync();
        var stockBefore = product.StockQuantity;
        var order = await NewOrderAsync();

        Assert.Equal("PendingPayment", order.Status);
        Assert.True(order.IsEditable);

        var withItem = await (await _client.PostAsJsonAsync(
            $"/api/orders/{order.Id}/items", new AddOrderItemRequest(product.Id, 2), Json))
            .Content.ReadFromJsonAsync<OrderDto>(Json);

        Assert.Equal(product.Price * 2, withItem!.TotalAmount);
        Assert.Equal(stockBefore - 2, await StockOfAsync(product.Id));

        foreach (var (action, expected) in new[]
                 {
                     ("pay", "Paid"), ("process", "Processing"), ("ship", "Shipped")
                 })
        {
            var response = await _client.PostAsync($"/api/orders/{order.Id}/{action}", null);
            response.EnsureSuccessStatusCode();

            var updated = await response.Content.ReadFromJsonAsync<OrderDto>(Json);
            Assert.Equal(expected, updated!.Status);
        }

        var shipped = await _client.GetFromJsonAsync<OrderDto>($"/api/orders/{order.Id}", Json);
        Assert.Empty(shipped!.NextStates);
        Assert.False(shipped.IsEditable);
        Assert.NotNull(shipped.ShippedAt);

        // El stock consumido no vuelve al catálogo por enviar el pedido.
        Assert.Equal(stockBefore - 2, await StockOfAsync(product.Id));
    }

    [Fact]
    public async Task Cancelling_an_order_puts_the_reserved_stock_back()
    {
        var product = await FirstProductAsync();
        var stockBefore = await StockOfAsync(product.Id);
        var order = await NewOrderAsync();

        await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, 3), Json);

        Assert.Equal(stockBefore - 3, await StockOfAsync(product.Id));

        var cancelled = await (await _client.PostAsync($"/api/orders/{order.Id}/cancel", null))
            .Content.ReadFromJsonAsync<OrderDto>(Json);

        Assert.Equal("Cancelled", cancelled!.Status);
        Assert.Equal(stockBefore, await StockOfAsync(product.Id));
    }

    [Fact]
    public async Task Asking_for_more_units_than_available_is_a_conflict_with_actionable_data()
    {
        var product = await FirstProductAsync();
        var order = await NewOrderAsync();

        var response = await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, product.StockQuantity + 500), Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var (code, body) = await ReadProblemAsync(response);
        Assert.Equal("insufficient_stock", code);
        Assert.Equal(product.StockQuantity + 500, body.GetProperty("requested").GetInt32());
        Assert.True(body.GetProperty("available").GetInt32() >= 0);

        // Una reserva rechazada no puede haber tocado el stock.
        Assert.Equal(product.StockQuantity, await StockOfAsync(product.Id));
    }

    [Fact]
    public async Task An_empty_order_cannot_be_paid()
    {
        var order = await NewOrderAsync();

        var response = await _client.PostAsync($"/api/orders/{order.Id}/pay", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var (code, _) = await ReadProblemAsync(response);
        Assert.Equal("invalid_order_state", code);
    }

    [Fact]
    public async Task Adding_the_same_product_twice_is_rejected_without_consuming_stock()
    {
        var product = await FirstProductAsync();
        var order = await NewOrderAsync();

        await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, 1), Json);

        var stockAfterFirst = await StockOfAsync(product.Id);

        var response = await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, 1), Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var (code, _) = await ReadProblemAsync(response);
        Assert.Equal("duplicate_order_item", code);
        Assert.Equal(stockAfterFirst, await StockOfAsync(product.Id));
    }

    [Fact]
    public async Task Changing_a_line_quantity_adjusts_the_stock_by_the_exact_difference()
    {
        var product = await FirstProductAsync();
        var stockBefore = await StockOfAsync(product.Id);
        var order = await NewOrderAsync();

        await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, 1), Json);

        await _client.PutAsJsonAsync($"/api/orders/{order.Id}/items/{product.Id}",
            new ChangeOrderItemQuantityRequest(3), Json);
        Assert.Equal(stockBefore - 3, await StockOfAsync(product.Id));

        await _client.PutAsJsonAsync($"/api/orders/{order.Id}/items/{product.Id}",
            new ChangeOrderItemQuantityRequest(2), Json);
        Assert.Equal(stockBefore - 2, await StockOfAsync(product.Id));

        await _client.DeleteAsync($"/api/orders/{order.Id}/items/{product.Id}");
        Assert.Equal(stockBefore, await StockOfAsync(product.Id));
    }

    [Fact]
    public async Task A_duplicated_sku_is_rejected_with_a_conflict()
    {
        var product = await FirstProductAsync();

        var response = await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest(product.Sku, "Intento duplicado", 10m, 1), Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var (code, _) = await ReadProblemAsync(response);
        Assert.Equal("duplicate_sku", code);
    }

    [Fact]
    public async Task Invalid_payloads_are_rejected_before_reaching_the_domain()
    {
        var order = await NewOrderAsync();

        var response = await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(Guid.NewGuid(), 0), Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_order_returns_a_problem_details_404()
    {
        var response = await _client.GetAsync($"/api/orders/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var (code, body) = await ReadProblemAsync(response);
        Assert.Equal("not_found", code);
        Assert.Equal("Order", body.GetProperty("resource").GetString());
    }

    [Fact]
    public async Task The_state_machine_published_by_the_api_matches_the_domain()
    {
        var body = await _client.GetFromJsonAsync<JsonElement>("/api/meta/order-state-machine");

        Assert.Equal("PendingPayment", body.GetProperty("initialState").GetString());

        var shipped = body.GetProperty("states").EnumerateArray()
            .Single(state => state.GetProperty("name").GetString() == "Shipped");

        Assert.True(shipped.GetProperty("isTerminal").GetBoolean());
        Assert.Empty(shipped.GetProperty("transitions").EnumerateArray());
    }

    [Fact]
    public async Task Dashboard_metrics_stay_consistent_with_the_orders_that_produced_them()
    {
        var product = await FirstProductAsync();
        var order = await NewOrderAsync();

        await _client.PostAsJsonAsync($"/api/orders/{order.Id}/items",
            new AddOrderItemRequest(product.Id, 2), Json);
        await _client.PostAsync($"/api/orders/{order.Id}/pay", null);

        var stats = await _client.GetFromJsonAsync<DashboardStatsDto>("/api/dashboard/stats", Json);

        Assert.True(stats!.ConfirmedRevenue >= product.Price * 2);
        Assert.Equal(5, stats.StatusBreakdown.Count);
        Assert.Equal(14, stats.RevenueTimeline.Count);
        Assert.Contains(stats.TopProducts, top => top.Sku == product.Sku);
    }

    [Fact]
    public async Task The_client_application_and_the_documentation_are_both_served()
    {
        var spa = await _client.GetAsync("/");
        spa.EnsureSuccessStatusCode();
        Assert.Contains("text/html", spa.Content.Headers.ContentType!.MediaType);
        Assert.Contains("NainOrder", await spa.Content.ReadAsStringAsync());

        var swagger = await _client.GetAsync("/swagger/v1/swagger.json");
        swagger.EnsureSuccessStatusCode();

        var health = await _client.GetAsync("/health");
        health.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Deep_links_of_the_client_application_fall_back_to_the_spa()
    {
        var response = await _client.GetAsync("/pedidos");

        response.EnsureSuccessStatusCode();
        Assert.Contains("text/html", response.Content.Headers.ContentType!.MediaType);
    }

    [Fact]
    public async Task An_unknown_api_route_returns_json_404_and_never_the_client_application()
    {
        // Sin esta separación, el fallback de la SPA respondería 200 con HTML a cualquier
        // ruta de API mal escrita, y un cliente que espera JSON fallaría de forma opaca.
        foreach (var path in new[] { "/api/noexiste", "/api/products/no-es-un-guid", "/swagger/noexiste" })
        {
            var response = await _client.GetAsync(path);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

            var (code, _) = await ReadProblemAsync(response);
            Assert.Equal("endpoint_not_found", code);
        }
    }
}
