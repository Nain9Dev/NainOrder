using Microsoft.EntityFrameworkCore;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence;

public class NainOrderDbContext : DbContext
{
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Customer> Customers { get; set; }

    public NainOrderDbContext(DbContextOptions<NainOrderDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Aplicar todas las configuraciones de Fluent API definidas en el ensamblado
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NainOrderDbContext).Assembly);
    }
}
