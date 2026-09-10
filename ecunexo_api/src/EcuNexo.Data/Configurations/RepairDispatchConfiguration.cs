using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairDispatchConfiguration : IEntityTypeConfiguration<RepairDispatch>
{
    public void Configure(EntityTypeBuilder<RepairDispatch> builder)
    {
        builder.ToTable("dispatches", "repairs");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(d => d.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(d => d.BatchId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(d => d.DispatchNumber)
            .HasMaxLength(RepairDispatch.DispatchNumberMaxLength)
            .IsRequired();

        builder.Property(d => d.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(d => d.CarrierName)
            .HasMaxLength(RepairDispatch.CarrierNameMaxLength);

        builder.Property(d => d.CarrierDocument)
            .HasMaxLength(RepairDispatch.CarrierDocumentMaxLength);

        builder.Property(d => d.CarrierVehiclePlate)
            .HasMaxLength(RepairDispatch.CarrierVehiclePlateMaxLength);

        builder.Property(d => d.VerificationHash)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(d => d.QrCodeUrl)
            .HasMaxLength(500);

        builder.Property(d => d.Notes);

        builder.Property(d => d.InvoiceId)
            .HasColumnType("uuid");

        builder.Property(d => d.DispatchedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(d => d.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(d => d.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(d => d.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(d => d.Items)
            .WithOne(i => i.Dispatch)
            .HasForeignKey(i => i.DispatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => new { d.TenantId, d.DispatchNumber }).IsUnique();
        builder.HasIndex(d => d.VerificationHash).IsUnique();
        builder.HasIndex(d => new { d.BatchId, d.Status });
    }
}
