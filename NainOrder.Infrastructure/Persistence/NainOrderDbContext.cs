using Microsoft.EntityFrameworkCore;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence;

public class NainOrderDbContext : DbContext
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();

    public NainOrderDbContext(DbContextOptions<NainOrderDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Toda la configuración vive en Fluent API: el dominio no conoce EF Core ni SQL.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NainOrderDbContext).Assembly);
    }
}
