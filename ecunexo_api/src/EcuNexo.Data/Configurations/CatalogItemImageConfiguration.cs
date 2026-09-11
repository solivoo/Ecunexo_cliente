using EcuNexo.Core.Catalog;
using EcuNexo.Core.Catalog.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CatalogItemImageConfiguration : IEntityTypeConfiguration<CatalogItemImage>
{
    public void Configure(EntityTypeBuilder<CatalogItemImage> builder)
    {
        builder.ToTable("item_images", "catalog");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.StorageKey)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(i => i.OriginalFileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(i => i.AltText)
            .HasMaxLength(ImageOptimizationPolicy.MaxAltTextLength);

        builder.Property(i => i.DisplayOrder)
            .IsRequired();

        builder.Property(i => i.IsMain)
            .IsRequired();

        builder.Property(i => i.OriginalWidth)
            .IsRequired();

        builder.Property(i => i.OriginalHeight)
            .IsRequired();

        builder.Property(i => i.FileSizeBytes)
            .IsRequired();

        builder.Property(i => i.MimeType)
            .HasMaxLength(50)
            .IsRequired()
            .HasDefaultValue(ImageOptimizationPolicy.CanonicalMimeType);

        builder.Property(i => i.ThumbUrl)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(i => i.MediumUrl)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(i => i.LargeUrl)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(i => i.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(i => i.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(i => i.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(i => i.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(i => i.CatalogItemId);
        builder.HasIndex(i => new { i.CatalogItemId, i.DisplayOrder });
    }
}
