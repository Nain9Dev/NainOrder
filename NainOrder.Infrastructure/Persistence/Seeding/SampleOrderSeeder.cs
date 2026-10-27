using Microsoft.EntityFrameworkCore;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;

namespace NainOrder.Infrastructure.Persistence.Seeding;

/// <summary>
/// Sample orders for a fresh instance, so the dashboard has something to show before anyone
/// touches the panel (REQ-120). They run only when the database holds no order at all: an
/// instance someone has already used is never changed. Every order is built through the aggregate
/// and moves stock through <see cref="Product"/>, exactly as <c>OrderService</c> does, so no
/// invariant is bypassed; only the timestamps are then moved back so the orders spread across the
/// dashboard's timeline instead of piling up on the day the instance started.
/// </summary>
internal static class SampleOrderSeeder
{
    private sealed record Sample(
        string CustomerEmail,
        OrderStatus Status,
        int DaysAgo,
        int MinutesBeforeTheHour,
        (string Sku, int Quantity)[] Lines);

    /// <summary>
    /// Only customers and products the catalogue seed already defines. Six orders over twelve days,
    /// every state of the machine represented, the newest still waiting for payment.
    /// </summary>
    private static readonly Sample[] Samples =
    [
        new("marta.iglesias@example.com", OrderStatus.Shipped,        11, 20, [("NO-LAP-001", 1), ("NO-MON-001", 1)]),
        new("diego.serrano@example.com",  OrderStatus.Shipped,         8, 45, [("NO-KEY-001", 2), ("NO-MOU-001", 2)]),
        new("diego.serrano@example.com",  OrderStatus.Cancelled,       6, 10, [("NO-AUD-001", 1)]),
        new("nuria.cabrera@example.com",  OrderStatus.Processing,      5, 30, [("NO-LAP-002", 1), ("NO-STO-001", 1)]),
        new("marta.iglesias@example.com", OrderStatus.Paid,            2, 50, [("NO-MON-002", 2)]),
        new("demo@naindev.com",           OrderStatus.PendingPayment,  0, 95, [("NO-NET-001", 1), ("NO-AUD-002", 1)])
    ];

    private static readonly TimeSpan PaymentDelay = TimeSpan.FromMinutes(4);
    private static readonly TimeSpan ShippingDelay = TimeSpan.FromHours(22);
    private static readonly TimeSpan CancellationDelay = TimeSpan.FromHours(2);

    public static async Task<bool> SeedAsync(NainOrderDbContext context, CancellationToken cancellationToken)
    {
        if (await context.Orders.AnyAsync(cancellationToken)) return false;

        var customers = await context.Customers.ToDictionaryAsync(c => c.Email, cancellationToken);
        var products = await context.Products.ToDictionaryAsync(p => p.Sku, cancellationToken);
        var now = DateTime.UtcNow;

        foreach (var sample in Samples)
        {
            var createdAt = now.AddDays(-sample.DaysAgo).AddMinutes(-sample.MinutesBeforeTheHour);
            var order = new Order(customers[sample.CustomerEmail].Id);

            foreach (var (sku, quantity) in sample.Lines)
            {
                var product = products[sku];
                order.AddItem(product.Id, product.Name, product.Sku, product.Price, quantity);
                product.RemoveStock(quantity);
            }

            DateTime? paidAt = null, shippedAt = null, cancelledAt = null;

            switch (sample.Status)
            {
                case OrderStatus.Paid:
                    order.MarkAsPaid();
                    paidAt = createdAt + PaymentDelay;
                    break;
                case OrderStatus.Processing:
                    order.MarkAsPaid();
                    order.MarkAsProcessing();
                    paidAt = createdAt + PaymentDelay;
                    break;
                case OrderStatus.Shipped:
                    order.MarkAsPaid();
                    order.MarkAsProcessing();
                    order.MarkAsShipped();
                    paidAt = createdAt + PaymentDelay;
                    shippedAt = createdAt + ShippingDelay;
                    break;
                case OrderStatus.Cancelled:
                    foreach (var restoration in order.Cancel())
                        products.Values.Single(p => p.Id == restoration.ProductId).AddStock(restoration.Quantity);
                    cancelledAt = createdAt + CancellationDelay;
                    break;
            }

            // The aggregate stamps "now"; the sample is dated in the past through the tracked entry,
            // the same way the seeder pins DemoCustomerId, so the domain keeps no setter for it.
            var entry = context.Orders.Add(order);
            entry.Property(nameof(Order.CreatedAt)).CurrentValue = createdAt;
            entry.Property(nameof(Order.PaidAt)).CurrentValue = paidAt;
            entry.Property(nameof(Order.ShippedAt)).CurrentValue = shippedAt;
            entry.Property(nameof(Order.CancelledAt)).CurrentValue = cancelledAt;
            // Same shape the aggregate builds, for the moved date (SampleOrdersSeedTests asserts it).
            entry.Property(nameof(Order.Reference)).CurrentValue =
                $"NO-{createdAt:yyyyMMdd}-{order.Id.ToString("N")[..6].ToUpperInvariant()}";
        }

        return true;
    }
}
