using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ShippingZoneConfiguration : IEntityTypeConfiguration<ShippingZone>
{
    public void Configure(EntityTypeBuilder<ShippingZone> builder)
    {
        builder.ToTable("shipping_zones", "logistics");

        builder.HasKey(z => z.Id);

        builder.Property(z => z.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(z => z.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(z => z.Tenant)
            .WithMany()
            .HasForeignKey(z => z.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(z => z.Code)
            .HasMaxLength(ShippingZone.CodeMaxLength)
            .IsRequired();

        builder.Property(z => z.Name)
            .HasMaxLength(ShippingZone.NameMaxLength)
            .IsRequired();

        builder.Property(z => z.Description)
            .HasMaxLength(ShippingZone.DescriptionMaxLength);

        builder.Property(z => z.Provinces)
            .HasMaxLength(ShippingZone.ProvincesMaxLength);

        builder.Property(z => z.SortOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(z => z.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(z => z.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(z => z.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(z => z.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(z => z.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(z => new { z.TenantId, z.Code })
            .IsUnique()
            .HasDatabaseName("ix_shipping_zones_tenant_code");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
