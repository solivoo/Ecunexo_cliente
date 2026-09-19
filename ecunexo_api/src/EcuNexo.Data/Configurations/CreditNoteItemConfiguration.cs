using EcuNexo.Core.CreditNotes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CreditNoteItemConfiguration : IEntityTypeConfiguration<CreditNoteItem>
{
    public void Configure(EntityTypeBuilder<CreditNoteItem> builder)
    {
        builder.ToTable("credit_note_items", "billing");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.CreditNoteId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.LineNumber)
            .IsRequired();

        builder.Property(i => i.ItemCode)
            .HasMaxLength(CreditNoteItem.CodeMaxLength)
            .IsRequired();

        builder.Property(i => i.AdditionalCode)
            .HasMaxLength(CreditNoteItem.CodeMaxLength);

        builder.Property(i => i.Description)
            .HasMaxLength(CreditNoteItem.DescriptionMaxLength)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasPrecision(18, 6)
            .IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasPrecision(18, 6)
            .IsRequired();

        builder.Property(i => i.Discount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.Subtotal)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.VatCode)
            .HasMaxLength(5)
            .HasDefaultValue("2")
            .IsRequired();

        builder.Property(i => i.VatPercentageCode)
            .HasMaxLength(5)
            .HasDefaultValue("4")
            .IsRequired();

        builder.Property(i => i.VatRate)
            .HasPrecision(5, 2)
            .IsRequired();

        builder.Property(i => i.VatBase)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.VatAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.Total)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.WarehouseId)
            .HasColumnType("uuid");

        builder.HasIndex(i => i.CreditNoteId);
    }
}
