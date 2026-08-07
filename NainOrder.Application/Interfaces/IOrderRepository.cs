using NainOrder.Domain.Entities;

namespace NainOrder.Application.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id);
    Task AddAsync(Order order);
    Task UpdateAsync(Order order);
    Task SaveChangesAsync();
}
