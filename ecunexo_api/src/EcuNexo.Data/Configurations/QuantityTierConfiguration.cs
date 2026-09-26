using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class QuantityTierConfiguration : IEntityTypeConfiguration<QuantityTier>
{
    public void Configure(EntityTypeBuilder<QuantityTier> builder)
    {
        builder.ToTable("quantity_tiers", "pricing");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.ProductPriceId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.QuantityFrom)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(t => t.QuantityTo)
            .HasColumnType("numeric(18,4)");

        builder.Property(t => t.UnitPrice)
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

        builder.HasIndex(t => new { t.ProductPriceId, t.QuantityFrom })
            .IsUnique()
            .HasDatabaseName("ux_quantity_tiers_price_from");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
