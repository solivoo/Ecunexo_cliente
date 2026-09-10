using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RepairEquipmentPhotoConfiguration : IEntityTypeConfiguration<RepairEquipmentPhoto>
{
    public void Configure(EntityTypeBuilder<RepairEquipmentPhoto> builder)
    {
        builder.ToTable("equipment_photos", "repairs");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.EquipmentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(p => p.UploadedBy)
            .HasColumnType("uuid");

        builder.Property(p => p.Stage)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(p => p.S3Bucket)
            .HasMaxLength(RepairEquipmentPhoto.S3BucketMaxLength)
            .IsRequired();

        builder.Property(p => p.S3Key)
            .HasMaxLength(RepairEquipmentPhoto.S3KeyMaxLength)
            .IsRequired();

        builder.Property(p => p.FileName)
            .HasMaxLength(RepairEquipmentPhoto.FileNameMaxLength)
            .IsRequired();

        builder.Property(p => p.ContentType)
            .HasMaxLength(RepairEquipmentPhoto.ContentTypeMaxLength)
            .IsRequired()
            .HasDefaultValue("image/webp");

        builder.Property(p => p.FileSizeBytes)
            .IsRequired();

        builder.Property(p => p.Caption)
            .HasMaxLength(RepairEquipmentPhoto.CaptionMaxLength);

        builder.Property(p => p.CapturedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(p => p.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(p => new { p.EquipmentId, p.Stage });
    }
}
