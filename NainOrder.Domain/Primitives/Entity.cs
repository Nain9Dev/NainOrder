namespace NainOrder.Domain.Primitives;

/// <summary>
/// Clase base para entidades de dominio con identidad tipada y comparación por igualdad de clave.
/// </summary>
public abstract class Entity<TId> : IEntity, IEquatable<Entity<TId>>
    where TId : notnull
{
    public TId Id { get; protected set; } = default!;

    protected Entity() { }

    protected Entity(TId id) => Id = id;

    public bool Equals(Entity<TId>? other)
    {
        if (other is null || other.GetType() != GetType()) return false;
        return EqualityComparer<TId>.Default.Equals(Id, other.Id);
    }

    public override bool Equals(object? obj) => obj is Entity<TId> entity && Equals(entity);

    public override int GetHashCode() => EqualityComparer<TId>.Default.GetHashCode(Id);

    public static bool operator ==(Entity<TId>? a, Entity<TId>? b) =>
        a is not null && b is not null ? a.Equals(b) : ReferenceEquals(a, b);

    public static bool operator !=(Entity<TId>? a, Entity<TId>? b) => !(a == b);
}
