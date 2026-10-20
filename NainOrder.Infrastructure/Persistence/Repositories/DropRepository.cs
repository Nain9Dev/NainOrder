using Microsoft.EntityFrameworkCore;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;

namespace NainOrder.Infrastructure.Persistence.Repositories;

public class DropRepository : IDropRepository
{
    private readonly NainOrderDbContext _context;

    public DropRepository(NainOrderDbContext context) => _context = context;

    public Task<Drop?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Drops
            .Include(d => d.Holds)
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Drop>> GetRecentAsync(int count, CancellationToken cancellationToken = default) =>
        await _context.Drops
            .AsNoTracking()
            .Include(d => d.Holds)
            .OrderByDescending(d => d.CreatedAt)
            .Take(count)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Drop>> GetWithDueHoldsAsync(DateTime now, CancellationToken cancellationToken = default) =>
        await _context.Drops
            .Include(d => d.Holds)
            .Where(d => d.Holds.Any(h => h.State == HoldState.Active && h.ExpiresAt <= now))
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Drop drop, CancellationToken cancellationToken = default) =>
        await _context.Drops.AddAsync(drop, cancellationToken);
}
