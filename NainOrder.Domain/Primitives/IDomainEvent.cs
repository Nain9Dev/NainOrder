namespace NainOrder.Domain.Primitives;

/// <summary>
/// Contrato base inmutable para todos los eventos del dominio.
/// </summary>
public interface IDomainEvent
{
    Guid EventId { get; }
    DateTime OccurredOnUtc { get; }
}
