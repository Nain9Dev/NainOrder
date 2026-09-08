using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace NainOrder.Infrastructure.Persistence.Converters;

/// <summary>
/// Persiste importes monetarios como enteros de céntimos.
/// <para>
/// SQLite no tiene tipo decimal: EF Core lo almacenaría como TEXT, con lo que
/// <c>ORDER BY</c> y <c>SUM</c> operarían sobre cadenas y darían resultados incorrectos.
/// Guardar céntimos en INTEGER hace que ordenación y agregación sean exactas y que no
/// exista error de coma flotante en el redondeo de dinero.
/// </para>
/// </summary>
public sealed class MoneyConverter : ValueConverter<decimal, long>
{
    public const int Scale = 100;

    public MoneyConverter()
        : base(
            amount => (long)decimal.Round(amount * Scale, 0, MidpointRounding.AwayFromZero),
            cents => cents / (decimal)Scale)
    {
    }

    public static decimal FromCents(long cents) => cents / (decimal)Scale;
}
