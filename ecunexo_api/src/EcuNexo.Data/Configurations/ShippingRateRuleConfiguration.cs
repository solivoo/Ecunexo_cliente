using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ShippingRateRuleConfiguration : IEntityTypeConfiguration<ShippingRateRule>
{
    public void Configure(EntityTypeBuilder<ShippingRateRule> builder)
    {
        builder.ToTable("shipping_rate_rules", "logistics");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(r => r.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(r => r.Tenant)
            .WithMany()
            .HasForeignKey(r => r.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(r => r.Carrier)
            .HasMaxLength(ShippingRateRule.CarrierMaxLength)
            .IsRequired();

        builder.Property(r => r.Zone)
            .HasMaxLength(ShippingRateRule.ZoneMaxLength)
            .IsRequired();

        builder.Property(r => r.Name)
            .HasMaxLength(ShippingRateRule.NameMaxLength)
            .IsRequired();

        builder.Property(r => r.MinQuantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(r => r.MaxQuantity)
            .HasColumnType("numeric(18,4)");

        builder.Property(r => r.MinOrderAmount)
            .HasColumnType("numeric(18,2)");

        builder.Property(r => r.Price)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(r => r.TaxRate)
            .HasColumnType("numeric(5,2)")
            .IsRequired()
            .HasDefaultValue(15m);

        builder.Property(r => r.EstimatedDays)
            .HasMaxLength(ShippingRateRule.EstimatedDaysMaxLength);

        builder.Property(r => r.Notes)
            .HasMaxLength(ShippingRateRule.NotesMaxLength);

        builder.Property(r => r.SortOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(r => r.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(r => r.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(r => r.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(r => r.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(r => r.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(r => r.ShippingZoneId)
            .HasColumnType("uuid");

        builder.HasOne(r => r.ShippingZone)
            .WithMany()
            .HasForeignKey(r => r.ShippingZoneId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(r => r.ShippingMethodId)
            .HasColumnType("uuid");

        builder.HasOne(r => r.ShippingMethod)
            .WithMany()
            .HasForeignKey(r => r.ShippingMethodId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(r => new { r.TenantId, r.Zone, r.Carrier, r.IsActive })
            .HasDatabaseName("ix_shipping_rate_rules_tenant_zone_carrier");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
