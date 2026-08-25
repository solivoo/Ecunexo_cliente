using EcuNexo.Core.Warehousing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> builder)
    {
        builder.ToTable("warehouses", "warehousing");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(w => w.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(w => w.Tenant)
            .WithMany()
            .HasForeignKey(w => w.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(w => w.Name)
            .HasMaxLength(Warehouse.NameMaxLength)
            .IsRequired();

        builder.Property(w => w.Code)
            .HasMaxLength(Warehouse.CodeMaxLength);

        builder.Property(w => w.AddressJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(w => w.IsMain)
            .IsRequired();

        builder.Property(w => w.IsSystem)
            .IsRequired();

        builder.Property(w => w.SystemRole)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(w => w.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(w => w.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(w => w.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(w => w.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(w => w.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(w => w.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(w => new { w.TenantId, w.Name })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.HasIndex(w => new { w.TenantId, w.Code })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL AND code IS NOT NULL");

        builder.HasIndex(w => new { w.TenantId, w.IsMain })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL AND is_main = TRUE");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
