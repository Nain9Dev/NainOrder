using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly NainOrderDbContext _context;

    public ProductRepository(NainOrderDbContext context) => _context = context;

    public async Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await _context.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    /// <summary>Una sola consulta para todos los productos de una cesta, evitando N+1.</summary>
    public async Task<IReadOnlyDictionary<Guid, Product>> GetByIdsAsync(
        IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0) return new Dictionary<Guid, Product>();

        return await _context.Products
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);
    }

    public Task<bool> SkuExistsAsync(string sku, CancellationToken cancellationToken = default) =>
        _context.Products.AnyAsync(p => p.Sku == sku, cancellationToken);

    public async Task<IReadOnlyList<Product>> GetAllAsync(
        string? search = null, string? category = null, CancellationToken cancellationToken = default)
    {
        var products = _context.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            products = products.Where(p =>
                EF.Functions.Like(p.Name, $"%{term}%") ||
                EF.Functions.Like(p.Sku, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim();
            products = products.Where(p => p.Category == normalized);
        }

        return await products
            .OrderBy(p => p.Category)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default) =>
        await _context.Products
            .AsNoTracking()
            .Select(p => p.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Product product, CancellationToken cancellationToken = default) =>
        await _context.Products.AddAsync(product, cancellationToken);
}
