using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly NainOrderDbContext _context;

    public OrderRepository(NainOrderDbContext context)
    {
        _context = context;
    }

    public async Task<Order?> GetByIdAsync(Guid id)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task AddAsync(Order order)
    {
        await _context.Orders.AddAsync(order);
    }

    public Task UpdateAsync(Order order)
    {
        // Las entidades ya están trackeadas por EF Core, no necesitamos llamar a Update() 
        // explícitamente. Llamar a Update() con GUIDs provoca que EF Core intente
        // actualizar items nuevos en lugar de insertarlos.
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
