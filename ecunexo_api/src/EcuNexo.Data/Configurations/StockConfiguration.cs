using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class StockConfiguration : IEntityTypeConfiguration<Stock>
{
    public void Configure(EntityTypeBuilder<Stock> builder)
    {
        builder.ToTable("stocks", "inventory");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(s => s.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(s => s.Tenant)
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(s => s.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(s => s.CatalogItem)
            .WithMany()
            .HasForeignKey(s => s.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(s => s.WarehouseId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(s => s.Warehouse)
            .WithMany()
            .HasForeignKey(s => s.WarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(s => s.Quantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(s => s.ReservedQuantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Ignore(s => s.AvailableQuantity);

        builder.Property(s => s.MinimumQuantity)
            .HasColumnType("numeric(18,4)");

        builder.Property(s => s.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(s => s.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(s => s.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(s => new { s.TenantId, s.CatalogItemId, s.WarehouseId })
            .IsUnique();

        builder.HasIndex(s => new { s.TenantId, s.WarehouseId });

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
