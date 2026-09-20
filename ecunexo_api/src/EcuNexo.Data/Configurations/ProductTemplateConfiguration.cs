using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class ProductTemplateConfiguration : IEntityTypeConfiguration<ProductTemplate>
{
    public void Configure(EntityTypeBuilder<ProductTemplate> builder)
    {
        builder.ToTable("product_templates", "catalog");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasMaxLength(ProductTemplate.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.Description)
            .HasMaxLength(ProductTemplate.DescriptionMaxLength);

        builder.Property(t => t.HierarchyTreeJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(t => t.IsActive)
            .HasColumnType("boolean")
            .HasDefaultValue(true)
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

        builder.HasIndex(t => new { t.TenantId, t.Name })
            .IsUnique();

        builder.HasIndex(t => t.HierarchyTreeJson)
            .HasMethod("gin");
    }
}
