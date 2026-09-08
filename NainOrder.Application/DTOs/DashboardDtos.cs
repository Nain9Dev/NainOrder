namespace NainOrder.Application.DTOs;

/// <summary>Métricas agregadas del panel. Se calculan en base de datos, no en memoria.</summary>
public record DashboardStatsDto(
    decimal ConfirmedRevenue,
    decimal PendingRevenue,
    int TotalOrders,
    int TotalCustomers,
    int TotalProducts,
    int TotalStockUnits,
    int LowStockProducts,
    decimal AverageOrderValue,
    IReadOnlyList<StatusBreakdownDto> StatusBreakdown,
    IReadOnlyList<RevenuePointDto> RevenueTimeline,
    IReadOnlyList<TopProductDto> TopProducts);

public record StatusBreakdownDto(string Status, int Count, decimal Amount);

public record RevenuePointDto(DateOnly Date, decimal Amount, int Orders);

public record TopProductDto(Guid ProductId, string Name, string Sku, int UnitsSold, decimal Revenue);
