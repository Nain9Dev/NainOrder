using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NainOrder.Application.DTOs;
using NainOrder.Infrastructure.Persistence.Seeding;

namespace NainOrder.Tests.Api;

/// <summary>
/// La afirmación "el stock no se puede sobrevender" es la más fuerte que hace este
/// proyecto, así que se demuestra en lugar de declararse: varias peticiones simultáneas
/// compiten por las mismas unidades y se comprueba que el inventario cuadra al final.
/// </summary>
public class ConcurrencyTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly NainOrderApiFactory _factory;
    private readonly HttpClient _client;

    public ConcurrencyTests(NainOrderApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<Guid> CreateOrderAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/orders",
            new CreateOrderRequest(DatabaseSeeder.DemoCustomerId), Json);

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<OrderDto>(Json))!.Id;
    }

    [Fact]
    public async Task Concurrent_reservations_never_oversell_the_available_stock()
    {
        const int availableStock = 6;
        const int contenders = 16;

        var product = await (await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest($"NO-RACE-{Guid.NewGuid():N}"[..20], "Unidad en disputa",
                                     99.99m, availableStock), Json))
            .Content.ReadFromJsonAsync<ProductDto>(Json);

        // Cada contendiente lleva su propio pedido: así compiten por el stock del producto
        // y no por el mismo agregado de pedido, que es la carrera que interesa medir.
        var orderIds = new List<Guid>();
        for (var i = 0; i < contenders; i++) orderIds.Add(await CreateOrderAsync(_client));

        var barrier = new TaskCompletionSource();

        var attempts = orderIds.Select(async orderId =>
        {
            using var client = _factory.CreateClient();
            await barrier.Task;

            var response = await client.PostAsJsonAsync($"/api/orders/{orderId}/items",
                new AddOrderItemRequest(product!.Id, 1), Json);

            return response.StatusCode;
        }).ToList();

        // Se sueltan todas a la vez para maximizar el solapamiento real.
        barrier.SetResult();
        var outcomes = await Task.WhenAll(attempts);

        var granted = outcomes.Count(status => status == HttpStatusCode.OK);
        var rejected = outcomes.Count(status => status is HttpStatusCode.Conflict);
        var unexpected = outcomes.Where(status => status is not (HttpStatusCode.OK or HttpStatusCode.Conflict)).ToList();

        var remaining = (await _client.GetFromJsonAsync<ProductDto>($"/api/products/{product!.Id}", Json))!
            .StockQuantity;

        // Ninguna petición puede fallar por un motivo técnico: o se concede o se rechaza
        // por regla de negocio.
        Assert.True(unexpected.Count == 0,
            $"Respuestas inesperadas: {string.Join(", ", unexpected)}");

        // Las invariantes: nunca se conceden más unidades de las que había, el stock no
        // queda negativo y lo concedido más lo restante suma exactamente el stock inicial.
        Assert.True(granted <= availableStock, $"Se concedieron {granted} de {availableStock} unidades.");
        Assert.True(remaining >= 0, $"El stock quedó en {remaining}.");

        // Si no se concediera ninguna, las invariantes se cumplirían de forma trivial y la
        // prueba no estaría midiendo nada.
        Assert.True(granted > 0, "Ninguna reserva prosperó: la prueba no estaría midiendo la carrera.");
        Assert.Equal(availableStock, granted + remaining);
        Assert.Equal(contenders, granted + rejected);
    }

    [Fact]
    public async Task Concurrent_changes_to_the_same_order_keep_the_totals_consistent()
    {
        var product = await (await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest($"NO-SAME-{Guid.NewGuid():N}"[..20], "Producto compartido",
                                     25m, 500), Json))
            .Content.ReadFromJsonAsync<ProductDto>(Json);

        var orderId = await CreateOrderAsync(_client);

        // Diez intentos simultáneos de añadir el MISMO producto al MISMO pedido: la regla
        // de línea única debe dejar pasar exactamente uno.
        var attempts = Enumerable.Range(0, 10).Select(async _ =>
        {
            using var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync($"/api/orders/{orderId}/items",
                new AddOrderItemRequest(product!.Id, 2), Json);
            return response.StatusCode;
        });

        var outcomes = await Task.WhenAll(attempts);
        var granted = outcomes.Count(status => status == HttpStatusCode.OK);

        var order = await _client.GetFromJsonAsync<OrderDto>($"/api/orders/{orderId}", Json);

        Assert.Equal(1, granted);
        Assert.Single(order!.Items);
        Assert.Equal(2, order.TotalUnits);
        Assert.Equal(product!.Price * 2, order.TotalAmount);
    }
}
