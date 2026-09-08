namespace NainOrder.Application.Interfaces;

/// <summary>
/// Frontera transaccional del caso de uso. Los repositorios solo declaran intención;
/// es el caso de uso quien decide cuándo se confirma el cambio, de modo que una
/// operación que toca varios agregados (pedido + stock) se persiste de forma atómica.
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Ejecuta la operación dentro de una transacción y confirma solo si termina sin excepción.</summary>
    Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default);

    Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default);
}
