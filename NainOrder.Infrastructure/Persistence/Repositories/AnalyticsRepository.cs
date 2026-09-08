using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Enums;
using NainOrder.Infrastructure.Persistence.Converters;

namespace NainOrder.Infrastructure.Persistence.Repositories;

/// <summary>
/// Lado de lectura del panel. Agrega en base de datos con SQL explícito sobre las
/// columnas de céntimos (INTEGER), en lugar de materializar pedidos en memoria: el
/// coste no crece con el volumen de datos y la suma de dinero es exacta.
/// </summary>
public class AnalyticsRepository : IAnalyticsRepository
{
    /// <summary>Estados que representan ingreso ya comprometido por el cliente.</summary>
    private static readonly int[] ConfirmedStatuses =
    [
        (int)OrderStatus.Paid, (int)OrderStatus.Processing, (int)OrderStatus.Shipped
    ];

    private const int TopProductsLimit = 5;

    private readonly NainOrderDbContext _context;

    public AnalyticsRepository(NainOrderDbContext context) => _context = context;

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(
        int timelineDays, CancellationToken cancellationToken = default)
    {
        var connection = _context.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        if (openedHere) await connection.OpenAsync(cancellationToken);

        try
        {
            var breakdown = await ReadStatusBreakdownAsync(connection, cancellationToken);
            var catalog = await ReadCatalogTotalsAsync(connection, cancellationToken);
            var timeline = await ReadRevenueTimelineAsync(connection, timelineDays, cancellationToken);
            var topProducts = await ReadTopProductsAsync(connection, cancellationToken);

            var confirmed = breakdown
                .Where(b => ConfirmedStatuses.Contains((int)Enum.Parse<OrderStatus>(b.Status)))
                .Sum(b => b.Amount);

            var pending = breakdown
                .Where(b => b.Status == nameof(OrderStatus.PendingPayment))
                .Sum(b => b.Amount);

            var confirmedOrders = breakdown
                .Where(b => ConfirmedStatuses.Contains((int)Enum.Parse<OrderStatus>(b.Status)))
                .Sum(b => b.Count);

            var totalOrders = breakdown.Sum(b => b.Count);

            var averageOrderValue = confirmedOrders == 0
                ? 0m
                : decimal.Round(confirmed / confirmedOrders, 2, MidpointRounding.AwayFromZero);

            return new DashboardStatsDto(
                confirmed,
                pending,
                totalOrders,
                catalog.Customers,
                catalog.Products,
                catalog.StockUnits,
                catalog.LowStock,
                averageOrderValue,
                breakdown,
                timeline,
                topProducts);
        }
        finally
        {
            if (openedHere) await connection.CloseAsync();
        }
    }

    private static async Task<IReadOnlyList<StatusBreakdownDto>> ReadStatusBreakdownAsync(
        DbConnection connection, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Status, COUNT(*) AS OrderCount, COALESCE(SUM(TotalAmount), 0) AS AmountCents
            FROM Orders
            GROUP BY Status
            """;

        var byStatus = new Dictionary<OrderStatus, (int Count, long Cents)>();

        await using var command = CreateCommand(connection, sql);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var status = (OrderStatus)reader.GetInt32(0);
            byStatus[status] = (reader.GetInt32(1), reader.GetInt64(2));
        }

        // Se devuelven todos los estados, incluidos los que están a cero, para que el
        // cliente pueda pintar la distribución completa sin inventar categorías.
        return Enum.GetValues<OrderStatus>()
            .Select(status =>
            {
                var (count, cents) = byStatus.GetValueOrDefault(status);
                return new StatusBreakdownDto(status.ToString(), count, MoneyConverter.FromCents(cents));
            })
            .ToList();
    }

    private static async Task<(int Customers, int Products, int StockUnits, int LowStock)> ReadCatalogTotalsAsync(
        DbConnection connection, CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT
              (SELECT COUNT(*) FROM Customers),
              (SELECT COUNT(*) FROM Products),
              (SELECT COALESCE(SUM(StockQuantity), 0) FROM Products),
              (SELECT COUNT(*) FROM Products WHERE StockQuantity <= {StockLevels.LowStockThreshold})
            """;

        await using var command = CreateCommand(connection, sql);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken)) return (0, 0, 0, 0);

        return (reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetInt32(3));
    }

    private static async Task<IReadOnlyList<RevenuePointDto>> ReadRevenueTimelineAsync(
        DbConnection connection, int timelineDays, CancellationToken cancellationToken)
    {
        var days = Math.Clamp(timelineDays, 1, 90);
        var from = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-(days - 1)));

        // La fecha se compara sobre los 10 primeros caracteres del texto ISO almacenado
        // por EF: así el filtro es independiente del separador de fecha/hora que use el
        // proveedor y no depende de las funciones de fecha de SQLite.
        var sql = $"""
            SELECT substr(CreatedAt, 1, 10) AS Day,
                   COUNT(*) AS OrderCount,
                   COALESCE(SUM(CASE WHEN Status IN ({string.Join(",", ConfirmedStatuses)})
                                     THEN TotalAmount ELSE 0 END), 0) AS AmountCents
            FROM Orders
            WHERE substr(CreatedAt, 1, 10) >= $from
            GROUP BY Day
            """;

        var byDay = new Dictionary<DateOnly, (int Orders, long Cents)>();

        await using var command = CreateCommand(connection, sql);
        AddParameter(command, "$from", from.ToString("yyyy-MM-dd"));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (DateOnly.TryParse(reader.GetString(0), out var day))
                byDay[day] = (reader.GetInt32(1), reader.GetInt64(2));
        }

        // Serie continua sin huecos: los días sin actividad valen cero, no desaparecen.
        return Enumerable.Range(0, days)
            .Select(offset =>
            {
                var day = from.AddDays(offset);
                var (orders, cents) = byDay.GetValueOrDefault(day);
                return new RevenuePointDto(day, MoneyConverter.FromCents(cents), orders);
            })
            .ToList();
    }

    private static async Task<IReadOnlyList<TopProductDto>> ReadTopProductsAsync(
        DbConnection connection, CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT i.ProductId,
                   i.ProductName,
                   i.ProductSku,
                   SUM(i.Quantity) AS Units,
                   SUM(i.UnitPrice * i.Quantity) AS RevenueCents
            FROM OrderItems i
            INNER JOIN Orders o ON o.Id = i.OrderId
            WHERE o.Status <> {(int)OrderStatus.Cancelled}
            GROUP BY i.ProductId, i.ProductName, i.ProductSku
            ORDER BY Units DESC, RevenueCents DESC
            LIMIT {TopProductsLimit}
            """;

        var results = new List<TopProductDto>();

        await using var command = CreateCommand(connection, sql);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new TopProductDto(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                MoneyConverter.FromCents(reader.GetInt64(4))));
        }

        return results;
    }

    private static DbCommand CreateCommand(DbConnection connection, string sql)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;
        return command;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
