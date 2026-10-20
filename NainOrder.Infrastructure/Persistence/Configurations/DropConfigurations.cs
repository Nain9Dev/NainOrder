using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NainOrder.Domain.Entities;
using NainOrder.Infrastructure.Persistence.Converters;

namespace NainOrder.Infrastructure.Persistence.Configurations;

public class DropConfiguration : IEntityTypeConfiguration<Drop>
{
    public void Configure(EntityTypeBuilder<Drop> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();

        builder.Property(d => d.ProductName).IsRequired().HasMaxLength(Product.MaxNameLength);
        builder.Property(d => d.ProductSku).IsRequired().HasMaxLength(Product.MaxSkuLength);
        builder.Property(d => d.UnitPrice).HasConversion<MoneyConverter>();

        // Same pattern as ADR-0007: a losing writer fails the UPDATE instead of overwriting.
        builder.Property(d => d.Version).IsConcurrencyToken();

        builder.HasMany(d => d.Holds)
               .WithOne()
               .HasForeignKey(h => h.DropId)
               .OnDelete(DeleteBehavior.Cascade);

        // Holds change only through the aggregate, so EF reads and writes the backing field.
        builder.Navigation(d => d.Holds).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasOne<Product>()
               .WithMany()
               .HasForeignKey(d => d.ProductId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(d => d.CreatedAt);
    }
}

public class HoldConfiguration : IEntityTypeConfiguration<Hold>
{
    public void Configure(EntityTypeBuilder<Hold> builder)
    {
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();

        builder.Property(h => h.BuyerToken).IsRequired().HasMaxLength(64);
        builder.Property(h => h.State).HasConversion<int>();

        builder.HasIndex(h => new { h.DropId, h.BuyerToken });
        builder.HasIndex(h => new { h.State, h.ExpiresAt });
    }
}
