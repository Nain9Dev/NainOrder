namespace NainOrder.Domain.Primitives;

/// <summary>
/// Objeto de valor inmutable con igualdad estructural basada en sus atributos constitutivos.
/// </summary>
public abstract class ValueObject : IEquatable<ValueObject>
{
    protected abstract IEnumerable<object?> GetAtomicValues();

    public bool Equals(ValueObject? other)
    {
        if (other is null || other.GetType() != GetType()) return false;
        return GetAtomicValues().SequenceEqual(other.GetAtomicValues());
    }

    public override bool Equals(object? obj) => obj is ValueObject vo && Equals(vo);

    public override int GetHashCode() =>
        GetAtomicValues().Aggregate(default(int), (hashcode, value) => HashCode.Combine(hashcode, value?.GetHashCode() ?? 0));

    public static bool operator ==(ValueObject? a, ValueObject? b) =>
        a is not null && b is not null ? a.Equals(b) : ReferenceEquals(a, b);

    public static bool operator !=(ValueObject? a, ValueObject? b) => !(a == b);
}
