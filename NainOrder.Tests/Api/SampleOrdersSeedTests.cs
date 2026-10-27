using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Domain.Enums;
using NainOrder.Infrastructure.Persistence;
using NainOrder.Infrastructure.Persistence.Seeding;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-120 and REQ-121: a fresh instance opens its dashboard on sample orders in every state, built
/// through the domain, and an operator can switch them off. Verified over HTTP on the real application.
/// </summary>
public class SampleOrdersSeedTests : IClassFixture<NainOrderApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly NainOrderApiFactory _factory;
    private readonly HttpClient _client;

    public SampleOrdersSeedTests(NainOrderApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<DashboardStatsDto> StatsAsync() =>
        (await _client.GetFromJsonAsync<DashboardStatsDto>("/api/dashboard/stats", Json))!;

    // The fixture is this class's own instance and no test here opens an order, so every order in
    // the database is a sample order.
    private async Task<IReadOnlyList<OrderSummaryDto>> SampleOrdersAsync() =>
        (await _client.GetFromJsonAsync<PagedResult<OrderSummaryDto>>("/api/orders?page=1&pageSize=100", Json))!.Items;

    [Fact]
    public async Task A_fresh_instance_reports_orders_in_every_state_with_revenue_and_best_sellers()
    {
        var stats = await StatsAsync();

        foreach (var status in Enum.GetNames<OrderStatus>())
        {
            var row = Assert.Single(stats.StatusBreakdown, b => b.Status == status);
            Assert.True(row.Count >= 1, $"No sample order in state {status}.");
        }

        Assert.True(stats.ConfirmedRevenue > 0);
        Assert.True(stats.PendingRevenue > 0);
        Assert.True(stats.AverageOrderValue > 0);
        Assert.NotEmpty(stats.TopProducts);

        // Dated across the window, not piled on the day the instance started.
        var daysWithOrders = stats.RevenueTimeline.Count(p => p.Orders > 0);
        Assert.True(daysWithOrders >= 3, $"Sample orders cover {daysWithOrders} day(s) of the timeline.");
        Assert.Contains(stats.RevenueTimeline, p => p.Amount > 0);
    }

    [Fact]
    public async Task Sample_orders_are_built_through_the_domain()
    {
        var orders = await SampleOrdersAsync();
        Assert.NotEmpty(orders);

        foreach (var summary in orders)
        {
            var order = (await _client.GetFromJsonAsync<OrderDto>($"/api/orders/{summary.Id}", Json))!;

            // Totals are the sum of the lines (ADR-0004) and the reference carries the creation date.
            Assert.Equal(order.Items.Sum(i => i.TotalPrice), order.TotalAmount);
            Assert.Equal(order.Items.Sum(i => i.Quantity), order.TotalUnits);
            Assert.StartsWith($"NO-{order.CreatedAt:yyyyMMdd}-", order.Reference, StringComparison.Ordinal);

            // Timestamps follow the state machine.
            Assert.True(order.CreatedAt <= DateTime.UtcNow);
            switch (Enum.Parse<OrderStatus>(order.Status))
            {
                case OrderStatus.PendingPayment:
                    Assert.Null(order.PaidAt);
                    Assert.True(order.IsEditable);
                    break;
                case OrderStatus.Paid:
                case OrderStatus.Processing:
                    Assert.True(order.PaidAt >= order.CreatedAt);
                    Assert.Null(order.ShippedAt);
                    break;
                case OrderStatus.Shipped:
                    Assert.True(order.PaidAt >= order.CreatedAt);
                    Assert.True(order.ShippedAt >= order.PaidAt);
                    break;
                case OrderStatus.Cancelled:
                    Assert.True(order.CancelledAt >= order.CreatedAt);
                    break;
            }
        }
    }

    [Fact]
    public async Task Sample_orders_reserve_stock_by_the_same_rules_as_a_real_order()
    {
        // Every product still holds its catalogue figure minus the units of non-cancelled sample
        // orders: a cancelled order returned its units. Read in one go so the picture is consistent.
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NainOrderDbContext>();

        var products = context.Products.ToList();
        var orders = context.Orders.ToList();
        var items = context.OrderItems.ToList();

        Assert.Contains(orders, o => o.Status == OrderStatus.Cancelled);

        foreach (var (sku, _, _, _, catalogStock, _) in DatabaseSeeder.CatalogSeed)
        {
            var product = Assert.Single(products, p => p.Sku == sku);

            var reserved = items
                .Where(i => i.ProductId == product.Id)
                .Where(i => orders.Single(o => o.Id == i.OrderId).Status != OrderStatus.Cancelled)
                .Sum(i => i.Quantity);

            Assert.Equal(catalogStock - reserved, product.StockQuantity);
        }
    }

    [Fact]
    public async Task Seeding_again_adds_nothing()
    {
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NainOrderDbContext>();

        var before = context.Orders.Count();
        await DatabaseSeeder.SeedAsync(context);

        Assert.Equal(before, context.Orders.Count());
    }

    [Fact]
    public async Task The_sample_orders_can_be_switched_off_by_configuration()
    {
        await using var bare = new NainOrderApiFactory();
        using var client = bare
            .WithWebHostBuilder(builder => builder.UseSetting("Seed:SampleOrders", "false"))
            .CreateClient();

        var stats = (await client.GetFromJsonAsync<DashboardStatsDto>("/api/dashboard/stats", Json))!;

        Assert.Equal(0, stats.TotalOrders);
        Assert.True(stats.TotalProducts > 0, "The catalogue is still seeded.");
        Assert.True(stats.TotalCustomers > 0, "The customers are still seeded.");
    }
}
