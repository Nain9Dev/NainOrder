using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NainOrder.Domain.Entities;
using NainOrder.Infrastructure.Persistence.Converters;

namespace NainOrder.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        // El dominio genera el Id: se declara explícitamente para que EF nunca dude
        // entre INSERT y UPDATE al descubrir la entidad a través de una navegación.
        builder.Property(o => o.Id).ValueGeneratedNever();

        builder.Property(o => o.Reference).IsRequired().HasMaxLength(32);
        builder.Property(o => o.Status).HasConversion<int>();
        builder.Property(o => o.TotalAmount).HasConversion<MoneyConverter>();

        builder.HasMany(o => o.Items)
               .WithOne()
               .HasForeignKey(i => i.OrderId)
               .OnDelete(DeleteBehavior.Cascade);

        // La cesta solo se manipula a través del agregado y la propiedad expone una
        // vista de solo lectura, así que EF debe leer y escribir el campo subyacente.
        builder.Navigation(o => o.Items).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasOne<Customer>()
               .WithMany()
               .HasForeignKey(o => o.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(o => o.Reference).IsUnique();
        builder.HasIndex(o => o.CreatedAt);
        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => o.CustomerId);
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();

        builder.Property(i => i.ProductName).IsRequired().HasMaxLength(Product.MaxNameLength);
        builder.Property(i => i.ProductSku).IsRequired().HasMaxLength(Product.MaxSkuLength);
        builder.Property(i => i.UnitPrice).HasConversion<MoneyConverter>();

        builder.HasOne<Product>()
               .WithMany()
               .HasForeignKey(i => i.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        // Un producto no puede repetirse dentro del mismo pedido: la regla vive en el
        // dominio y aquí se refuerza a nivel de motor.
        builder.HasIndex(i => new { i.OrderId, i.ProductId }).IsUnique();
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.Name).IsRequired().HasMaxLength(Customer.MaxNameLength);
        builder.Property(c => c.Email).IsRequired().HasMaxLength(Customer.MaxEmailLength);

        builder.HasIndex(c => c.Email).IsUnique();
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Sku).IsRequired().HasMaxLength(Product.MaxSkuLength);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(Product.MaxNameLength);
        builder.Property(p => p.Category).IsRequired().HasMaxLength(Product.MaxCategoryLength);
        builder.Property(p => p.Description).IsRequired().HasMaxLength(Product.MaxDescriptionLength);
        builder.Property(p => p.Price).HasConversion<MoneyConverter>();

        // Concurrencia optimista sobre el stock: si dos peticiones simultáneas intentan
        // reservar la última unidad, la segunda falla en el UPDATE en lugar de sobrevender.
        builder.Property(p => p.Version).IsConcurrencyToken();

        builder.HasIndex(p => p.Sku).IsUnique();
        builder.HasIndex(p => p.Category);
    }
}
