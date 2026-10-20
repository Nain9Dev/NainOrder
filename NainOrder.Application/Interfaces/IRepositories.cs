using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Interfaces;

/// <summary>
/// Acceso al agregado Order. No expone <c>Update</c>: las entidades recuperadas quedan
/// bajo seguimiento del contexto y el cambio se confirma vía <see cref="IUnitOfWork"/>.
/// </summary>
public interface IOrderRepository
{
    /// <summary>Carga el agregado completo (con sus líneas) para escritura.</summary>
    Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(Order order, CancellationToken cancellationToken = default);

    /// <summary>Proyección paginada de solo lectura para listados; no carga el agregado.</summary>
    Task<PagedResult<OrderSummaryDto>> GetPagedSummariesAsync(
        OrderQuery query, PageRequest page, CancellationToken cancellationToken = default);
}

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Carga varios productos de una vez para evitar el patrón N+1 al montar una cesta.</summary>
    Task<IReadOnlyDictionary<Guid, Product>> GetByIdsAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);

    Task<bool> SkuExistsAsync(string sku, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Product>> GetAllAsync(
        string? search = null, string? category = null, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default);

    Task AddAsync(Product product, CancellationToken cancellationToken = default);
}

public interface IDropRepository
{
    /// <summary>Loads the drop with its holds, tracked: it is about to be mutated.</summary>
    Task<Drop?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Drop>> GetRecentAsync(int count, CancellationToken cancellationToken = default);

    /// <summary>Drops that still carry an active hold whose window has ended at <paramref name="now"/>.</summary>
    Task<IReadOnlyList<Drop>> GetWithDueHoldsAsync(DateTime now, CancellationToken cancellationToken = default);

    Task AddAsync(Drop drop, CancellationToken cancellationToken = default);
}

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Customer>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);

    Task AddAsync(Customer customer, CancellationToken cancellationToken = default);
}

/// <summary>
/// Lado de lectura (CQRS): consultas analíticas que se resuelven en base de datos y
/// devuelven directamente el modelo de lectura, sin materializar agregados.
/// </summary>
public interface IAnalyticsRepository
{
    Task<DashboardStatsDto> GetDashboardStatsAsync(int timelineDays, CancellationToken cancellationToken = default);
}
