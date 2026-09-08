using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly NainOrderDbContext _context;

    public OrderRepository(NainOrderDbContext context) => _context = context;

    /// <summary>Carga el agregado con seguimiento activado: se va a mutar.</summary>
    public Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

    public async Task AddAsync(Order order, CancellationToken cancellationToken = default) =>
        await _context.Orders.AddAsync(order, cancellationToken);

    /// <summary>
    /// Listado de solo lectura. Proyecta directamente a DTO sobre los totales ya
    /// materializados en la tabla, sin cargar las líneas ni activar el change tracker.
    /// </summary>
    public async Task<PagedResult<OrderSummaryDto>> GetPagedSummariesAsync(
        OrderQuery query, PageRequest page, CancellationToken cancellationToken = default)
    {
        var orders = _context.Orders.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Status) &&
            Enum.TryParse<OrderStatus>(query.Status, ignoreCase: true, out var status))
        {
            orders = orders.Where(o => o.Status == status);
        }

        if (query.CustomerId is { } customerId && customerId != Guid.Empty)
            orders = orders.Where(o => o.CustomerId == customerId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            orders = orders.Where(o => EF.Functions.Like(o.Reference, $"%{term}%"));
        }

        var totalCount = await orders.CountAsync(cancellationToken);
        if (totalCount == 0) return PagedResult<OrderSummaryDto>.Empty(page.Page, page.PageSize);

        var rows = await orders
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Skip(page.Skip)
            .Take(page.PageSize)
            .Select(o => new
            {
                o.Id,
                o.Reference,
                o.CustomerId,
                CustomerName = _context.Customers
                    .Where(c => c.Id == o.CustomerId)
                    .Select(c => c.Name)
                    .FirstOrDefault(),
                o.Status,
                o.TotalAmount,
                o.TotalUnits,
                LineCount = o.Items.Count,
                o.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(r => new OrderSummaryDto(
                r.Id, r.Reference, r.CustomerId, r.CustomerName, r.Status.ToString(),
                r.TotalAmount, r.TotalUnits, r.LineCount, r.CreatedAt))
            .ToList();

        return new PagedResult<OrderSummaryDto>(items, page.Page, page.PageSize, totalCount);
    }
}
