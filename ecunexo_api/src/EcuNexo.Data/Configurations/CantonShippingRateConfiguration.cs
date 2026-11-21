using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CantonShippingRateConfiguration : IEntityTypeConfiguration<CantonShippingRate>
{
    public void Configure(EntityTypeBuilder<CantonShippingRate> builder)
    {
        builder.ToTable("canton_shipping_rates", "logistics");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(r => r.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(r => r.CantonId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(r => r.ShippingMethodId)
            .HasColumnType("uuid");

        builder.Property(r => r.BasePrice)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(r => r.BaseWeightKg)
            .HasColumnType("numeric(12,4)")
            .HasDefaultValue(CantonShippingRate.DefaultBaseWeightKg)
            .IsRequired();

        builder.Property(r => r.AdditionalKgPrice)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(r => r.VolumetricDivisor)
            .HasColumnType("numeric(10,2)")
            .HasDefaultValue(CantonShippingRate.DefaultVolumetricDivisor)
            .IsRequired();

        builder.Property(r => r.RoundUpExtraKg)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(r => r.FreeShippingMinAmount)
            .HasColumnType("numeric(18,2)");

        builder.Property(r => r.TaxRate)
            .HasColumnType("numeric(5,2)")
            .HasDefaultValue(CantonShippingRate.DefaultTaxRate)
            .IsRequired();

        builder.Property(r => r.EstimatedDays)
            .HasMaxLength(CantonShippingRate.EstimatedDaysMaxLength);

        builder.Property(r => r.IsEnabled)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property<uint>("xmin")
            .IsRowVersion();

        builder.HasOne(r => r.Canton)
            .WithMany()
            .HasForeignKey(r => r.CantonId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ShippingMethod)
            .WithMany()
            .HasForeignKey(r => r.ShippingMethodId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(r => new { r.TenantId, r.CantonId, r.ShippingMethodId })
            .IsUnique()
            .HasDatabaseName("ix_canton_shipping_rates_tenant_canton_method");
    }
}
