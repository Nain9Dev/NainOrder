using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Infrastructure;

/// <summary>
/// Marks expired drop holds once a second. A failed pass is logged and retried on the next tick:
/// the sweeper is an optimisation over lazy expiry, never the source of correctness (ADR-0008).
/// </summary>
public sealed class HoldExpirySweeper : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HoldExpirySweeper> _logger;

    public HoldExpirySweeper(IServiceScopeFactory scopeFactory, ILogger<HoldExpirySweeper> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var drops = scope.ServiceProvider.GetRequiredService<IDropService>();
                var expired = await drops.ExpireDueHoldsAsync(stoppingToken);

                if (expired > 0) _logger.LogInformation("Expired {Count} drop holds", expired);
            }
            catch (ConflictException)
            {
                // A buyer wrote to the same drop first; the next tick sweeps again.
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Hold expiry sweep failed");
            }
        }
    }
}
