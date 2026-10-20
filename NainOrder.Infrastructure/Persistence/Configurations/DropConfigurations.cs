using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using NainOrder.Domain.Entities;
using NainOrder.Infrastructure.Persistence.Converters;

namespace NainOrder.Infrastructure.Persistence.Configurations;

public class DropConfiguration : IEntityTypeConfiguration<Drop>
{
    internal static readonly ValueConverter<DateTime, DateTime> AsUtc =
        new(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    public void Configure(EntityTypeBuilder<Drop> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();

        builder.Property(d => d.ProductName).IsRequired().HasMaxLength(Product.MaxNameLength);
        builder.Property(d => d.ProductSku).IsRequired().HasMaxLength(Product.MaxSkuLength);
        builder.Property(d => d.UnitPrice).HasConversion<MoneyConverter>();

        // SQLite returns DateTime as Unspecified; without UTC the API would serialise a bare
        // timestamp that browsers read as local time and every countdown would be off by the offset.
        builder.Property(d => d.OpensAt).HasConversion(AsUtc);
        builder.Property(d => d.CreatedAt).HasConversion(AsUtc);

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
        builder.Property(h => h.CreatedAt).HasConversion(DropConfiguration.AsUtc);
        builder.Property(h => h.ExpiresAt).HasConversion(DropConfiguration.AsUtc);

        builder.HasIndex(h => new { h.DropId, h.BuyerToken });
        builder.HasIndex(h => new { h.State, h.ExpiresAt });
    }
}
