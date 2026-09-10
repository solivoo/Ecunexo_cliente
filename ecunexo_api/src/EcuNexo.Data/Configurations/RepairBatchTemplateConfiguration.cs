using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairBatchTemplateConfiguration : IEntityTypeConfiguration<RepairBatchTemplate>
{
    public void Configure(EntityTypeBuilder<RepairBatchTemplate> builder)
    {
        builder.ToTable("batch_templates", "repairs");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(t => t.CustomerId)
            .HasColumnType("uuid");

        builder.HasOne(t => t.Customer)
            .WithMany()
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(t => t.Name)
            .HasMaxLength(RepairBatchTemplate.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.ColumnDefinitionsJson)
            .HasColumnType("jsonb")
            .IsRequired();

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

        builder.HasIndex(t => new { t.TenantId, t.Name });
    }
}
