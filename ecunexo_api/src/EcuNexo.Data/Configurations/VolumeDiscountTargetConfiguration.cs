using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class VolumeDiscountTargetConfiguration : IEntityTypeConfiguration<VolumeDiscountTarget>
{
    public void Configure(EntityTypeBuilder<VolumeDiscountTarget> builder)
    {
        builder.ToTable("volume_discount_targets", "pricing");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.VolumeDiscountSchemeId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.TargetType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(t => t.TargetReference)
            .HasMaxLength(VolumeDiscountTarget.ReferenceMaxLength)
            .IsRequired();

        builder.Property(t => t.IsExclusion)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(t => t.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(t => t.VolumeDiscountSchemeId)
            .HasDatabaseName("ix_volume_discount_targets_scheme_id");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
