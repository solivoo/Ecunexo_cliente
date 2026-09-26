using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("promotions", "pricing");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(p => p.Tenant)
            .WithMany()
            .HasForeignKey(p => p.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(p => p.Code)
            .HasMaxLength(Promotion.CodeMaxLength)
            .IsRequired();

        builder.Property(p => p.Name)
            .HasMaxLength(Promotion.NameMaxLength)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasMaxLength(Promotion.DescriptionMaxLength);

        builder.Property(p => p.Type)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(p => p.Value)
            .HasColumnType("numeric(18,6)")
            .IsRequired();

        builder.Property(p => p.StartsAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.EndsAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.Priority)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(p => p.IsStackable)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(p => p.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(p => p.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(p => new { p.TenantId, p.Code })
            .IsUnique()
            .HasDatabaseName("ux_promotions_tenant_code");

        builder.HasIndex(p => new { p.TenantId, p.IsActive, p.StartsAt, p.EndsAt });

        builder.HasMany(p => p.Targets)
            .WithOne(t => t.Promotion)
            .HasForeignKey(t => t.PromotionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
