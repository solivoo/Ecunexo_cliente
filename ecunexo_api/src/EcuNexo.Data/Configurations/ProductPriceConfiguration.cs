using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ProductPriceConfiguration : IEntityTypeConfiguration<ProductPrice>
{
    public void Configure(EntityTypeBuilder<ProductPrice> builder)
    {
        builder.ToTable("product_prices", "pricing");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(p => p.Tenant)
            .WithMany()
            .HasForeignKey(p => p.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(p => p.PriceListId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(p => p.PriceList)
            .WithMany()
            .HasForeignKey(p => p.PriceListId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(p => p.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(p => p.CatalogItem)
            .WithMany()
            .HasForeignKey(p => p.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(p => p.Price)
            .HasColumnType("numeric(18,6)")
            .IsRequired();

        builder.Property(p => p.ValidFrom)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(p => p.ValidTo)
            .HasColumnType("date");

        builder.Property(p => p.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(p => new { p.TenantId, p.PriceListId, p.CatalogItemId, p.ValidFrom })
            .IsUnique()
            .HasDatabaseName("ux_product_prices_tenant_list_item_from");

        builder.HasIndex(p => new { p.TenantId, p.CatalogItemId, p.PriceListId, p.ValidFrom, p.ValidTo })
            .HasDatabaseName("ix_product_prices_lookup");

        builder.HasMany(p => p.Tiers)
            .WithOne(t => t.ProductPrice)
            .HasForeignKey(t => t.ProductPriceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
