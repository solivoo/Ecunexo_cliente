using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ShippingMethodConfiguration : IEntityTypeConfiguration<ShippingMethod>
{
    public void Configure(EntityTypeBuilder<ShippingMethod> builder)
    {
        builder.ToTable("shipping_methods", "logistics");

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

        builder.Property(m => m.Code)
            .HasMaxLength(ShippingMethod.CodeMaxLength)
            .IsRequired();

        builder.Property(m => m.Name)
            .HasMaxLength(ShippingMethod.NameMaxLength)
            .IsRequired();

        builder.Property(m => m.Description)
            .HasMaxLength(ShippingMethod.DescriptionMaxLength);

        builder.Property(m => m.EstimatedDays)
            .HasMaxLength(ShippingMethod.EstimatedDaysMaxLength);

        builder.Property(m => m.SortOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(m => m.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(m => m.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(m => m.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(m => m.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(m => m.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(m => new { m.TenantId, m.Code })
            .IsUnique()
            .HasDatabaseName("ix_shipping_methods_tenant_code");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
