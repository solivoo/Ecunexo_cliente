using System.Text.Json;
using EcuNexo.Core.CreditNotes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CreditNoteConfiguration : IEntityTypeConfiguration<CreditNote>
{
    public void Configure(EntityTypeBuilder<CreditNote> builder)
    {
        builder.ToTable("credit_notes", "billing");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(c => c.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(c => c.Establishment)
            .HasMaxLength(CreditNote.EstablishmentMaxLength)
            .HasDefaultValue("001")
            .IsRequired();

        builder.Property(c => c.EmissionPoint)
            .HasMaxLength(CreditNote.EmissionPointMaxLength)
            .HasDefaultValue("001")
            .IsRequired();

        builder.Property(c => c.Sequential)
            .HasMaxLength(CreditNote.SequentialMaxLength)
            .IsRequired();

        builder.Property(c => c.AccessKey)
            .HasMaxLength(CreditNote.AccessKeyLength)
            .IsRequired();

        builder.Property(c => c.IssueDate)
            .IsRequired();

        builder.Property(c => c.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(c => c.ReasonType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(c => c.Reason)
            .HasMaxLength(CreditNote.ReasonMaxLength)
            .IsRequired();

        builder.Property(c => c.ModifiedDocumentType)
            .HasMaxLength(5)
            .HasDefaultValue("01")
            .IsRequired();

        builder.Property(c => c.ModifiedDocumentNumber)
            .HasMaxLength(CreditNote.DocumentNumberLength)
            .IsRequired();

        builder.Property(c => c.ModifiedDocumentIssueDate)
            .IsRequired();

        builder.Property(c => c.ModifiedDocumentAuthorizationNumber)
            .HasMaxLength(49);

        builder.Property(c => c.ModifiedDocumentId)
            .HasColumnType("uuid");

        builder.Property(c => c.BuyerIdentificationType)
            .HasMaxLength(5)
            .HasDefaultValue("04")
            .IsRequired();

        builder.Property(c => c.BuyerIdentification)
            .HasMaxLength(CreditNote.IdentificationMaxLength)
            .IsRequired();

        builder.Property(c => c.BuyerName)
            .HasMaxLength(CreditNote.NameMaxLength)
            .IsRequired();

        builder.Property(c => c.BuyerAddress)
            .HasMaxLength(CreditNote.AddressMaxLength)
            .IsRequired();

        builder.Property(c => c.BuyerEmail)
            .HasMaxLength(150);

        builder.Property(c => c.SubtotalWithoutTaxes)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.TotalDiscount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalVat15)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalVat13)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalVat12)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalVat0)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalNoVat)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.SubtotalExemptVat)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.VatAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.ModificationValue)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(c => c.Environment)
            .HasMaxLength(1)
            .HasDefaultValue("1")
            .IsRequired();

        builder.Property(c => c.AuthorizationNumber)
            .HasMaxLength(49);

        builder.Property(c => c.SriMessages)
            .HasColumnType("text");

        builder.Property(c => c.XmlContent)
            .HasColumnType("text");

        builder.Property(c => c.AdditionalFields)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<List<CreditNoteAdditionalField>>(v, (JsonSerializerOptions?)null) ?? new List<CreditNoteAdditionalField>())
            .HasColumnType("jsonb");

        builder.Property(c => c.CreatedAt)
            .IsRequired();

        builder.Property(c => c.UpdatedAt);

        builder.Property(c => c.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.DeletedAt);

        builder.Property(c => c.DeletedBy)
            .HasColumnType("uuid");

        builder.HasMany(c => c.Items)
            .WithOne()
            .HasForeignKey(i => i.CreditNoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(c => new { c.TenantId, c.Establishment, c.EmissionPoint, c.Sequential })
            .IsUnique()
            .HasFilter("deleted_at IS NULL");

        builder.HasIndex(c => new { c.TenantId, c.IssueDate });
        builder.HasIndex(c => new { c.TenantId, c.Status });
        builder.HasIndex(c => new { c.TenantId, c.BuyerIdentification });
        builder.HasIndex(c => new { c.TenantId, c.ModifiedDocumentNumber });
    }
}
