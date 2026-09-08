using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Application.Services;

public class DashboardService : IDashboardService
{
    /// <summary>Ventana temporal del gráfico de ingresos del panel.</summary>
    public const int TimelineDays = 14;

    private readonly IAnalyticsRepository _analytics;

    public DashboardService(IAnalyticsRepository analytics) => _analytics = analytics;

    public Task<DashboardStatsDto> GetStatsAsync(CancellationToken cancellationToken = default) =>
        _analytics.GetDashboardStatsAsync(TimelineDays, cancellationToken);
}
