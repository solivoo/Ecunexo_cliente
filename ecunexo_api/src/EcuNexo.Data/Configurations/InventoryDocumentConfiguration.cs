using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class InventoryDocumentConfiguration : IEntityTypeConfiguration<InventoryDocument>
{
    public void Configure(EntityTypeBuilder<InventoryDocument> builder)
    {
        builder.ToTable("documents", "inventory");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(d => d.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(d => d.Tenant)
            .WithMany()
            .HasForeignKey(d => d.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(d => d.DocumentType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(d => d.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(d => d.WarehouseId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(d => d.Warehouse)
            .WithMany()
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(d => d.DestinationWarehouseId)
            .HasColumnType("uuid");

        builder.HasOne(d => d.DestinationWarehouse)
            .WithMany()
            .HasForeignKey(d => d.DestinationWarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(d => d.Notes)
            .HasMaxLength(InventoryDocument.NotesMaxLength);

        builder.Property(d => d.ReceiptOrigin)
            .HasConversion<int?>();

        builder.Property(d => d.SourceDocumentNumber)
            .HasMaxLength(InventoryDocument.SourceDocumentNumberMaxLength);

        builder.Property(d => d.ApprovedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.ApprovedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.ShippedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.ShippedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(d => d.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(d => d.Lines)
            .WithOne()
            .HasForeignKey(l => l.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(d => d.Lines)
            .HasField("_lines")
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(d => new { d.TenantId, d.Status, d.CreatedAt });

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
