using NainOrder.Domain.Exceptions;
using NainOrder.Domain.Primitives;

namespace NainOrder.Domain.ValueObjects;

/// <summary>
/// Immutable email address value object with structural domain validation.
/// </summary>
public sealed class EmailAddress : ValueObject
{
    public const int MaxEmailLength = 150;

    public string Value { get; }

    public EmailAddress(string value)
    {
        Value = Normalize(value);
    }

    private static string Normalize(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidDomainDataException(nameof(email), "Email is required.");

        var trimmed = email.Trim().ToLowerInvariant();

        var at = trimmed.IndexOf('@');
        var valid = at > 0
                    && at == trimmed.LastIndexOf('@')
                    && at < trimmed.Length - 1
                    && trimmed.LastIndexOf('.') > at + 1
                    && trimmed.Length <= MaxEmailLength
                    && !trimmed.Contains(' ')
                    && !trimmed.EndsWith('.');

        if (!valid)
            throw new InvalidDomainDataException(nameof(email), $"'{email}' is not a valid email address.");

        return trimmed;
    }

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return Value;
    }

    public override string ToString() => Value;

    public static implicit operator string(EmailAddress email) => email.Value;
    public static explicit operator EmailAddress(string email) => new(email);
}
