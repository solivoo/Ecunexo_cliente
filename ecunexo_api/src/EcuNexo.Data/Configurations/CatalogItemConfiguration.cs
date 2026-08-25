using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CatalogItemConfiguration : IEntityTypeConfiguration<CatalogItem>
{
    public void Configure(EntityTypeBuilder<CatalogItem> builder)
    {
        builder.ToTable("items", "catalog");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(i => i.Tenant)
            .WithMany()
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(i => i.CategoryId)
            .HasColumnType("uuid");

        builder.HasOne(i => i.Category)
            .WithMany()
            .HasForeignKey(i => i.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(i => i.Kind)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(i => i.Name)
            .HasMaxLength(CatalogItem.NameMaxLength)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasMaxLength(CatalogItem.DescriptionMaxLength);

        builder.Property(i => i.Sku)
            .HasMaxLength(global::EcuNexo.Core.Catalog.Sku.MaxLength);

        builder.Property(i => i.BasePrice)
            .HasColumnType("numeric(18,4)");

        builder.Property(i => i.CustomAttributesJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(i => i.Status)
            .HasConversion<int>()
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

        builder.Property(i => i.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(i => i.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(i => new { i.TenantId, i.Sku })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL AND sku IS NOT NULL");

        builder.HasIndex(i => new { i.TenantId, i.Kind, i.Name });

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
