using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace NainOrder.Infrastructure.Persistence.Diagnostics;

/// <summary>
/// How much of the current request was spent in the database: the summed duration and count of
/// the commands EF Core executed. One instance per request scope, filled by
/// <see cref="DatabaseTimingInterceptor"/> and read by the API's <c>Server-Timing</c> middleware,
/// so the panel's request map shows measured time, never an estimate (REQ-110).
/// </summary>
public sealed class RequestDatabaseTiming
{
    private long _ticks;
    private int _commands;

    public TimeSpan Total => TimeSpan.FromTicks(Interlocked.Read(ref _ticks));

    public int Commands => Volatile.Read(ref _commands);

    public bool Used => Commands > 0;

    public void Record(TimeSpan duration)
    {
        Interlocked.Add(ref _ticks, duration.Ticks);
        Interlocked.Increment(ref _commands);
    }
}

/// <summary>Feeds <see cref="RequestDatabaseTiming"/> with the real duration of each executed command.</summary>
public sealed class DatabaseTimingInterceptor : DbCommandInterceptor
{
    private readonly RequestDatabaseTiming _timing;

    public DatabaseTimingInterceptor(RequestDatabaseTiming timing) => _timing = timing;

    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        _timing.Record(eventData.Duration);
        return base.ReaderExecuted(command, eventData, result);
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
    {
        _timing.Record(eventData.Duration);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        _timing.Record(eventData.Duration);
        return base.NonQueryExecuted(command, eventData, result);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        _timing.Record(eventData.Duration);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        _timing.Record(eventData.Duration);
        return base.ScalarExecuted(command, eventData, result);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, object? result, CancellationToken cancellationToken = default)
    {
        _timing.Record(eventData.Duration);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }
}
