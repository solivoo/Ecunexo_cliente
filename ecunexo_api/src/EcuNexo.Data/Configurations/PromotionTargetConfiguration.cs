using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PromotionTargetConfiguration : IEntityTypeConfiguration<PromotionTarget>
{
    public void Configure(EntityTypeBuilder<PromotionTarget> builder)
    {
        builder.ToTable("promotion_targets", "pricing");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.PromotionId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.TargetType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(t => t.TargetReference)
            .HasMaxLength(PromotionTarget.ReferenceMaxLength)
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(t => t.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(t => t.PromotionId)
            .HasDatabaseName("ix_promotion_targets_promotion_id");

        builder.HasIndex(t => new { t.TargetType, t.TargetReference })
            .HasDatabaseName("ix_promotion_targets_target");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
