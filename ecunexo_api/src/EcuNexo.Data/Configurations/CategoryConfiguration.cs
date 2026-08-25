using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories", "catalog");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(c => c.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(c => c.Tenant)
            .WithMany()
            .HasForeignKey(c => c.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(c => c.ParentId)
            .HasColumnType("uuid");

        builder.HasOne(c => c.Parent)
            .WithMany()
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(c => c.Name)
            .HasMaxLength(Category.NameMaxLength)
            .IsRequired();

        builder.Property(c => c.Description)
            .HasMaxLength(Category.DescriptionMaxLength);

        builder.Property(c => c.AttributeSchemaJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(c => c.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(c => c.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(c => c.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.HasIndex(c => new { c.TenantId, c.ParentId });

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
