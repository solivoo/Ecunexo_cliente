using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class InventoryMovementConfiguration : IEntityTypeConfiguration<InventoryMovement>
{
    public void Configure(EntityTypeBuilder<InventoryMovement> builder)
    {
        builder.ToTable("movements", "inventory");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(m => m.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(m => m.Tenant)
            .WithMany()
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(m => m.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(m => m.CatalogItem)
            .WithMany()
            .HasForeignKey(m => m.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(m => m.WarehouseId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(m => m.Warehouse)
            .WithMany()
            .HasForeignKey(m => m.WarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(m => m.DocumentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(m => m.Document)
            .WithMany()
            .HasForeignKey(m => m.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(m => m.Direction)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(m => m.Quantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(m => m.OccurredAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(m => m.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(m => m.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(m => m.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(m => m.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(m => new { m.TenantId, m.OccurredAt });
        builder.HasIndex(m => new { m.TenantId, m.CatalogItemId, m.WarehouseId, m.OccurredAt });
        builder.HasIndex(m => m.DocumentId);
    }
}
