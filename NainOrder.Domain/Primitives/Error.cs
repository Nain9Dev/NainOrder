using System.Diagnostics.CodeAnalysis;

namespace NainOrder.Domain.Primitives;

/// <summary>
/// Representa un error de dominio con código inmutable legible por máquina.
/// </summary>
[SuppressMessage("Naming", "CA1716:Identifiers should not match keywords", Justification = "Standard DDD Domain primitive")]
public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    public static readonly Error NullValue = new("error.null_value", "The specified value is null.");

    public static implicit operator string(Error error) => error?.Code ?? string.Empty;
}
