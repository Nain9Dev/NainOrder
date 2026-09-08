using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly NainOrderDbContext _context;

    public CustomerRepository(NainOrderDbContext context) => _context = context;

    public async Task<Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await _context.Customers.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Customer>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.Customers
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

    public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) =>
        _context.Customers.AnyAsync(c => c.Email == email, cancellationToken);

    public async Task AddAsync(Customer customer, CancellationToken cancellationToken = default) =>
        await _context.Customers.AddAsync(customer, cancellationToken);
}
