using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairBatchConfiguration : IEntityTypeConfiguration<RepairBatch>
{
    public void Configure(EntityTypeBuilder<RepairBatch> builder)
    {
        builder.ToTable("batches", "repairs");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(b => b.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(b => b.CustomerId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(b => b.Customer)
            .WithMany()
            .HasForeignKey(b => b.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(b => b.TemplateId)
            .HasColumnType("uuid");

        builder.HasOne(b => b.Template)
            .WithMany()
            .HasForeignKey(b => b.TemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(b => b.BatchNumber)
            .HasMaxLength(RepairBatch.BatchNumberMaxLength)
            .IsRequired();

        builder.Property(b => b.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(b => b.TotalCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(b => b.ReceivedCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(b => b.InRepairCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(b => b.ReadyCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(b => b.DispatchedCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(b => b.AgreedRateN1)
            .HasColumnType("numeric(10,2)");

        builder.Property(b => b.AgreedRateN2)
            .HasColumnType("numeric(10,2)");

        builder.Property(b => b.AgreedRateN3)
            .HasColumnType("numeric(10,2)");

        builder.Property(b => b.ContractReference)
            .HasMaxLength(RepairBatch.ContractReferenceMaxLength);

        builder.Property(b => b.ExpectedCompletionAt)
            .HasColumnType("timestamptz");

        builder.Property(b => b.ReceivedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(b => b.MetadataJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(b => b.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(b => b.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(b => b.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(b => b.Equipments)
            .WithOne(e => e.Batch)
            .HasForeignKey(e => e.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Dispatches)
            .WithOne(d => d.Batch)
            .HasForeignKey(d => d.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(b => new { b.TenantId, b.BatchNumber }).IsUnique();
        builder.HasIndex(b => new { b.TenantId, b.CustomerId });
        builder.HasIndex(b => new { b.TenantId, b.Status });
    }
}
