using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly NainOrderDbContext _context;

    public ProductRepository(NainOrderDbContext context)
    {
        _context = context;
    }

    public async Task<Product?> GetByIdAsync(Guid id)
    {
        return await _context.Products.FindAsync(id);
    }

    public async Task<List<Product>> GetAllAsync()
    {
        return await _context.Products.ToListAsync();
    }

    public async Task AddAsync(Product product)
    {
        await _context.Products.AddAsync(product);
    }

    public Task UpdateAsync(Product product)
    {
        _context.Products.Update(product);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
