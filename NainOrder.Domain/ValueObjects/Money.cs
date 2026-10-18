using NainOrder.Domain.Exceptions;
using NainOrder.Domain.Primitives;

namespace NainOrder.Domain.ValueObjects;

/// <summary>
/// Immutable monetary value object with currency isolation and arithmetic validation.
/// </summary>
public sealed class Money : ValueObject, IComparable<Money>, IEquatable<Money>
{
    public const string DefaultCurrency = "EUR";

    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency = DefaultCurrency)
    {
        if (amount < 0)
            throw new InvalidDomainDataException(nameof(amount), "Money amount cannot be negative.");

        if (string.IsNullOrWhiteSpace(currency))
            throw new InvalidDomainDataException(nameof(currency), "Currency code is required.");

        Amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        Currency = currency.Trim().ToUpperInvariant();
    }

    public static Money Zero(string currency = DefaultCurrency) => new(0m, currency);

    public static Money operator +(Money a, Money b)
    {
        EnsureSameCurrency(a, b);
        return new Money(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator -(Money a, Money b)
    {
        EnsureSameCurrency(a, b);
        return new Money(a.Amount - b.Amount, a.Currency);
    }

    public static Money operator *(Money m, int multiplier)
    {
        if (multiplier < 0)
            throw new InvalidDomainDataException(nameof(multiplier), "Multiplier cannot be negative.");
        return new Money(m.Amount * multiplier, m.Currency);
    }

    public int CompareTo(Money? other)
    {
        if (other is null) return 1;
        EnsureSameCurrency(this, other);
        return Amount.CompareTo(other.Amount);
    }

    public bool Equals(Money? other) => base.Equals(other);
    public override bool Equals(object? obj) => obj is Money m && Equals(m);
    public override int GetHashCode() => base.GetHashCode();

    public static bool operator ==(Money? a, Money? b) =>
        a is not null && b is not null ? a.Equals(b) : ReferenceEquals(a, b);

    public static bool operator !=(Money? a, Money? b) => !(a == b);

    public static bool operator <(Money a, Money b) => a is not null && a.CompareTo(b) < 0;
    public static bool operator <=(Money a, Money b) => a is not null && a.CompareTo(b) <= 0;
    public static bool operator >(Money a, Money b) => a is not null && a.CompareTo(b) > 0;
    public static bool operator >=(Money a, Money b) => a is not null && a.CompareTo(b) >= 0;

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return Amount;
        yield return Currency;
    }

    public override string ToString() => $"{Amount:0.00} {Currency}";

    private static void EnsureSameCurrency(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            throw new InvalidDomainDataException("Currency", $"Cannot operate between different currencies '{a.Currency}' and '{b.Currency}'.");
    }
}
