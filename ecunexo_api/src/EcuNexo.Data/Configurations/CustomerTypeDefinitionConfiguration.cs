using EcuNexo.Core.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CustomerTypeDefinitionConfiguration : IEntityTypeConfiguration<CustomerTypeDefinition>
{
    public void Configure(EntityTypeBuilder<CustomerTypeDefinition> builder)
    {
        builder.ToTable("customer_types", "repairs");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.Code)
            .IsRequired();

        builder.Property(t => t.Name)
            .HasMaxLength(CustomerTypeDefinition.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.ShortLabel)
            .HasMaxLength(CustomerTypeDefinition.ShortLabelMaxLength)
            .IsRequired();

        builder.Property(t => t.Tone)
            .HasMaxLength(CustomerTypeDefinition.ToneMaxLength)
            .IsRequired();

        builder.Property(t => t.SortOrder)
            .IsRequired();

        builder.Property(t => t.IsSystem)
            .IsRequired()
            .HasDefaultValue(false);

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

        builder.Property(t => t.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(t => new { t.TenantId, t.Code })
            .IsUnique()
            .HasFilter("\"deleted_at\" IS NULL");

        builder.HasIndex(t => new { t.TenantId, t.Name })
            .HasFilter("\"deleted_at\" IS NULL");
    }
}
