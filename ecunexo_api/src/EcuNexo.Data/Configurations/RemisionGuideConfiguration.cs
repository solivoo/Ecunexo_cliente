using EcuNexo.Core.RemisionGuides;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class RemisionGuideConfiguration : IEntityTypeConfiguration<RemisionGuide>
{
    public void Configure(EntityTypeBuilder<RemisionGuide> builder)
    {
        builder.ToTable("remision_guides", "billing");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(g => g.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(g => g.Establishment)
            .HasMaxLength(RemisionGuide.EstablishmentMaxLength)
            .HasDefaultValue("001")
            .IsRequired();

        builder.Property(g => g.EmissionPoint)
            .HasMaxLength(RemisionGuide.EmissionPointMaxLength)
            .HasDefaultValue("001")
            .IsRequired();

        builder.Property(g => g.Sequential)
            .HasMaxLength(RemisionGuide.SequentialMaxLength)
            .IsRequired();

        builder.Property(g => g.AccessKey)
            .HasMaxLength(RemisionGuide.AccessKeyLength)
            .IsRequired();

        builder.Property(g => g.IssueDate)
            .IsRequired();

        builder.Property(g => g.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(g => g.AuthorizationNumber)
            .HasMaxLength(49);

        builder.Property(g => g.CarrierIdentificationType)
            .HasMaxLength(5)
            .HasDefaultValue("04")
            .IsRequired();

        builder.Property(g => g.CarrierIdentification)
            .HasMaxLength(RemisionGuide.IdentificationMaxLength)
            .IsRequired();

        builder.Property(g => g.CarrierName)
            .HasMaxLength(RemisionGuide.NameMaxLength)
            .IsRequired();

        builder.Property(g => g.CarrierEmail)
            .HasMaxLength(150);

        builder.Property(g => g.CarrierPhone)
            .HasMaxLength(30);

        builder.Property(g => g.LicensePlate)
            .HasMaxLength(RemisionGuide.LicensePlateMaxLength)
            .IsRequired();

        builder.Property(g => g.StartingAddress)
            .HasMaxLength(RemisionGuide.AddressMaxLength)
            .IsRequired();

        builder.Property(g => g.StartDate)
            .IsRequired();

        builder.Property(g => g.EndDate)
            .IsRequired();

        builder.Property(g => g.RecipientIdentificationType)
            .HasMaxLength(5)
            .HasDefaultValue("04")
            .IsRequired();

        builder.Property(g => g.RecipientIdentification)
            .HasMaxLength(RemisionGuide.IdentificationMaxLength)
            .IsRequired();

        builder.Property(g => g.RecipientName)
            .HasMaxLength(RemisionGuide.NameMaxLength)
            .IsRequired();

        builder.Property(g => g.RecipientAddress)
            .HasMaxLength(RemisionGuide.AddressMaxLength)
            .IsRequired();

        builder.Property(g => g.TransferReason)
            .HasMaxLength(RemisionGuide.ReasonMaxLength)
            .IsRequired();

        builder.Property(g => g.RouteDescription)
            .HasMaxLength(RemisionGuide.RouteMaxLength)
            .IsRequired();

        builder.Property(g => g.SupportDocumentType)
            .HasMaxLength(5);

        builder.Property(g => g.SupportDocumentNumber)
            .HasMaxLength(25);

        builder.Property(g => g.SupportDocumentAuth)
            .HasMaxLength(49);

        builder.Property(g => g.CustomsDocumentNumber)
            .HasMaxLength(50);

        builder.Property(g => g.SriMessages)
            .HasColumnType("text");

        builder.Property(g => g.XmlContent)
            .HasColumnType("text");

        builder.Property(g => g.CreatedAt)
            .IsRequired();

        builder.Property(g => g.UpdatedAt);

        builder.Property(g => g.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(g => g.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(g => g.DeletedAt);

        builder.Property(g => g.DeletedBy)
            .HasColumnType("uuid");

        builder.HasMany(g => g.Items)
            .WithOne()
            .HasForeignKey(i => i.RemisionGuideId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(g => new { g.TenantId, g.Establishment, g.EmissionPoint, g.Sequential })
            .IsUnique()
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(g => new { g.TenantId, g.IssueDate });
        builder.HasIndex(g => new { g.TenantId, g.LicensePlate });
        builder.HasIndex(g => new { g.TenantId, g.Status });
    }
}
