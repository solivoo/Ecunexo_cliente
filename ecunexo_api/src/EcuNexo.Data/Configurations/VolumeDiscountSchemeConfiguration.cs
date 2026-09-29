using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class VolumeDiscountSchemeConfiguration : IEntityTypeConfiguration<VolumeDiscountScheme>
{
    public void Configure(EntityTypeBuilder<VolumeDiscountScheme> builder)
    {
        builder.ToTable("volume_discount_schemes", "pricing");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(s => s.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(s => s.Tenant)
            .WithMany()
            .HasForeignKey(s => s.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(s => s.Name)
            .HasMaxLength(VolumeDiscountScheme.NameMaxLength)
            .IsRequired();

        builder.Property(s => s.Description)
            .HasMaxLength(VolumeDiscountScheme.DescriptionMaxLength);

        builder.Property(s => s.Type)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(s => s.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(s => s.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(s => s.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(s => s.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(s => s.Tiers)
            .WithOne(t => t.Scheme)
            .HasForeignKey(t => t.SchemeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.TenantId, s.Name })
            .HasDatabaseName("ix_volume_discount_schemes_tenant_name");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
