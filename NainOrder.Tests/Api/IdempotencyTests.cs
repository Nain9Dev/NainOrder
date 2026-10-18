using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NainOrder.Api.Infrastructure;
using NainOrder.Application.DTOs;
using NainOrder.Infrastructure.Persistence.Seeding;
using Xunit;

namespace NainOrder.Tests.Api;

public class IdempotencyTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _client;

    public IdempotencyTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Repeated_Post_With_Same_IdempotencyKey_Should_Return_Cached_Response()
    {
        var idempotencyKey = $"test-key-{Guid.NewGuid():N}";
        var request = new CreateOrderRequest(DatabaseSeeder.DemoCustomerId);

        using var message1 = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(request)
        };
        message1.Headers.Add(IdempotencyMiddleware.HeaderName, idempotencyKey);

        var response1 = await _client.SendAsync(message1);
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        var order1 = await response1.Content.ReadFromJsonAsync<OrderDto>(Json);
        Assert.NotNull(order1);

        // Repetir la misma petición con la misma clave de idempotencia
        using var message2 = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(request)
        };
        message2.Headers.Add(IdempotencyMiddleware.HeaderName, idempotencyKey);

        var response2 = await _client.SendAsync(message2);
        Assert.Equal(HttpStatusCode.Created, response2.StatusCode);
        Assert.True(response2.Headers.Contains("X-Cache-Lookup"));
        Assert.Equal("HIT", response2.Headers.GetValues("X-Cache-Lookup").First());

        var order2 = await response2.Content.ReadFromJsonAsync<OrderDto>(Json);
        Assert.NotNull(order2);
        Assert.Equal(order1.Id, order2.Id);
        Assert.Equal(order1.Reference, order2.Reference);
    }

    [Fact]
    public async Task Different_IdempotencyKeys_Should_Create_Different_Orders()
    {
        var request = new CreateOrderRequest(DatabaseSeeder.DemoCustomerId);

        using var msgA = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(request)
        };
        msgA.Headers.Add(IdempotencyMiddleware.HeaderName, $"key-a-{Guid.NewGuid():N}");

        var resA = await _client.SendAsync(msgA);
        Assert.Equal(HttpStatusCode.Created, resA.StatusCode);
        var orderA = await resA.Content.ReadFromJsonAsync<OrderDto>(Json);

        using var msgB = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(request)
        };
        msgB.Headers.Add(IdempotencyMiddleware.HeaderName, $"key-b-{Guid.NewGuid():N}");

        var resB = await _client.SendAsync(msgB);
        Assert.Equal(HttpStatusCode.Created, resB.StatusCode);
        var orderB = await resB.Content.ReadFromJsonAsync<OrderDto>(Json);

        Assert.NotNull(orderA);
        Assert.NotNull(orderB);
        Assert.NotEqual(orderA.Id, orderB.Id);
    }

    [Fact]
    public async Task Overly_Long_IdempotencyKey_Should_Return_400BadRequest()
    {
        var invalidKey = new string('x', IdempotencyMiddleware.MaxKeyLength + 1);
        var request = new CreateOrderRequest(DatabaseSeeder.DemoCustomerId);

        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(request)
        };
        message.Headers.Add(IdempotencyMiddleware.HeaderName, invalidKey);

        var response = await _client.SendAsync(message);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
