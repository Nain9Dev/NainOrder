using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;

namespace NainOrder.Benchmarks;

[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class OrderDomainBenchmarks
{
    private static readonly Guid BenchmarkCustomerId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ProductIdA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid ProductIdB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Benchmark(Baseline = true)]
    public Order CreateOrderWithItems()
    {
        var order = new Order(BenchmarkCustomerId);
        order.AddItem(ProductIdA, "Precision Sensor Model X", "SKU-SENS-01", 149.99m, 2);
        order.AddItem(ProductIdB, "Industrial Calibration Jig", "SKU-CALIB-02", 499.50m, 1);
        return order;
    }

    [Benchmark]
    public bool CheckAllowedStateTransitions()
    {
        var transitions = Order.TransitionsFrom(OrderStatus.PendingPayment);
        return transitions.Count > 0;
    }

    [Benchmark]
    public decimal CalculateOrderTotalsAndDiscounts()
    {
        var order = new Order(BenchmarkCustomerId);
        order.AddItem(ProductIdA, "Precision Sensor Model X", "SKU-SENS-01", 120.00m, 5);
        return order.TotalAmount;
    }
}
