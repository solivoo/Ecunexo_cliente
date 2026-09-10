using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairEquipmentConfiguration : IEntityTypeConfiguration<RepairEquipment>
{
    public void Configure(EntityTypeBuilder<RepairEquipment> builder)
    {
        builder.ToTable("equipments", "repairs");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(e => e.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(e => e.BatchId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(e => e.AssignedTechnicianId)
            .HasColumnType("uuid");

        builder.Property(e => e.SerialNumber)
            .HasMaxLength(RepairEquipment.SerialNumberMaxLength)
            .IsRequired();

        builder.Property(e => e.Model)
            .HasMaxLength(RepairEquipment.ModelMaxLength)
            .IsRequired();

        builder.Property(e => e.Brand)
            .HasMaxLength(RepairEquipment.BrandMaxLength)
            .IsRequired();

        builder.Property(e => e.ProductLine)
            .HasMaxLength(RepairEquipment.ProductLineMaxLength);

        builder.Property(e => e.DamageLevel)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(e => e.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(e => e.DiagnosticNotes);

        builder.Property(e => e.RepairNotes);

        builder.Property(e => e.QualityCheckNotes);

        builder.Property(e => e.PassedQualityCheck);

        builder.Property(e => e.DiagnosedAt)
            .HasColumnType("timestamptz");

        builder.Property(e => e.RepairedAt)
            .HasColumnType("timestamptz");

        builder.Property(e => e.QualityCheckedAt)
            .HasColumnType("timestamptz");

        builder.Property(e => e.ServiceFeeApplied)
            .HasColumnType("numeric(10,2)");

        builder.Property(e => e.CustomAttributesJson)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(e => e.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(e => e.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(e => e.Photos)
            .WithOne(p => p.Equipment)
            .HasForeignKey(p => p.EquipmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Events)
            .WithOne()
            .HasForeignKey(ev => ev.EquipmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.TenantId, e.SerialNumber });
        builder.HasIndex(e => new { e.BatchId, e.Status });
        builder.HasIndex(e => new { e.TenantId, e.Status });
        builder.HasIndex(e => e.CustomAttributesJson).HasMethod("gin");
    }
}
