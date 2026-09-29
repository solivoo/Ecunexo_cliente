using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class VolumeDiscountTierConfiguration : IEntityTypeConfiguration<VolumeDiscountTier>
{
    public void Configure(EntityTypeBuilder<VolumeDiscountTier> builder)
    {
        builder.ToTable("volume_discount_tiers", "pricing");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.SchemeId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.QuantityFrom)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(t => t.QuantityTo)
            .HasColumnType("numeric(18,4)");

        builder.Property(t => t.Value)
            .HasColumnType("numeric(18,6)")
            .IsRequired();

        builder.Property(t => t.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(t => t.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(t => new { t.SchemeId, t.QuantityFrom })
            .IsUnique()
            .HasDatabaseName("ux_volume_discount_tiers_scheme_from");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
