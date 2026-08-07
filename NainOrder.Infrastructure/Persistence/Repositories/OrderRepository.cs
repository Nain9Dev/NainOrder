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
        _context.Orders.Update(order);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
