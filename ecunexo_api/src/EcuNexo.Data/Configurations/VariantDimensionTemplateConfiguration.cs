using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class VariantDimensionTemplateConfiguration : IEntityTypeConfiguration<VariantDimensionTemplate>
{
    public void Configure(EntityTypeBuilder<VariantDimensionTemplate> builder)
    {
        builder.ToTable("variant_dimension_templates", "catalog");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasMaxLength(VariantDimensionTemplate.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.DimensionType)
            .HasMaxLength(VariantDimensionTemplate.DimensionTypeMaxLength)
            .IsRequired();

        builder.Property(t => t.DataType)
            .HasMaxLength(VariantDimensionTemplate.DataTypeMaxLength)
            .HasDefaultValue(VariantDimensionTemplate.DataTypeText)
            .IsRequired();

        builder.Property(t => t.IsVariantAxis)
            .HasColumnType("boolean")
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(t => t.Unit)
            .HasMaxLength(VariantDimensionTemplate.UnitMaxLength);

        builder.Property(t => t.PredefinedValuesJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(t => t.IsSystemDefault)
            .HasColumnType("boolean")
            .HasDefaultValue(false)
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
    }
}
