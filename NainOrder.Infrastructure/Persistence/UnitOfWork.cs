using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;

namespace NainOrder.Infrastructure.Persistence;

/// <summary>
/// Implementación de la frontera transaccional sobre EF Core. Traduce el fallo de
/// concurrencia optimista a una excepción de aplicación, de modo que los casos de uso
/// nunca vean tipos de EF Core.
/// </summary>
public sealed class UnitOfWork : IUnitOfWork
{
    private readonly NainOrderDbContext _context;

    public UnitOfWork(NainOrderDbContext context) => _context = context;

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "concurrency_conflict",
                "The record was modified by another request. Reload the data and try again.");
        }
    }

    public async Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default) =>
        await ExecuteInTransactionAsync<object?>(async ct =>
        {
            await operation(ct);
            return null;
        }, cancellationToken);

    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default)
    {
        // Si ya hay una transacción abierta (caso de uso compuesto), se respeta la
        // existente en vez de anidar una nueva, que SQLite no soporta.
        if (_context.Database.CurrentTransaction is not null)
            return await operation(cancellationToken);

        await using IDbContextTransaction transaction =
            await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var result = await operation(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
