using Microsoft.EntityFrameworkCore;
using NainOrder.Domain.Entities;
using NainOrder.Infrastructure.Persistence;

namespace NainOrder.Tests.Api;

public class OrderAggregateConcurrencyProbe : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), $"probe-{Guid.NewGuid():N}.db");

    private NainOrderDbContext NewContext() =>
        new(new DbContextOptionsBuilder<NainOrderDbContext>().UseSqlite($"Data Source={_path}").Options);

    [Fact]
    public async Task Two_concurrent_modifications_to_the_same_order_trigger_optimistic_concurrency_conflict_and_prevent_lost_updates()
    {
        using (var setup = NewContext())
        {
            await setup.Database.MigrateAsync();

            var customer = new Customer("Probe", "probe@example.com");
            var first = new Product("NO-PR-1", "First", 10m, 100);
            var second = new Product("NO-PR-2", "Second", 25m, 100);
            var order = new Order(customer.Id);
            order.AddItem(first.Id, first.Name, first.Sku, first.Price, 2);
            order.AddItem(second.Id, second.Name, second.Sku, second.Price, 3);

            setup.AddRange(customer, first, second);
            setup.Add(order);
            await setup.SaveChangesAsync();
        }

        Guid orderId;
        using (var read = NewContext()) orderId = read.Orders.Single().Id;

        // Two concurrent requests: each loads the aggregate, removes a different line.
        using var contextA = NewContext();
        using var contextB = NewContext();

        var orderA = await contextA.Orders.Include(o => o.Items).SingleAsync(o => o.Id == orderId);
        var orderB = await contextB.Orders.Include(o => o.Items).SingleAsync(o => o.Id == orderId);

        orderA.RemoveItem(orderA.Items.First(i => i.ProductSku == "NO-PR-1").ProductId);
        orderB.RemoveItem(orderB.Items.First(i => i.ProductSku == "NO-PR-2").ProductId);

        // Context A succeeds and increments Order.Version in database.
        await contextA.SaveChangesAsync();

        // Context B detects the stale Order.Version and throws DbUpdateConcurrencyException.
        var ex = await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => contextB.SaveChangesAsync());
        Assert.NotNull(ex);

        // Aggregate invariants remain consistent: totals equal the sum of remaining lines.
        using var verify = NewContext();
        var stored = await verify.Orders.Include(o => o.Items).SingleAsync(o => o.Id == orderId);

        Assert.Single(stored.Items);
        Assert.Equal(stored.Items.Sum(i => i.TotalPrice), stored.TotalAmount);
        Assert.Equal(stored.Items.Sum(i => i.Quantity), stored.TotalUnits);
    }

    public void Dispose()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try { if (File.Exists(_path)) File.Delete(_path); } catch (IOException) { }
        GC.SuppressFinalize(this);
    }
}
