using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PurchaseProformaConfiguration : IEntityTypeConfiguration<PurchaseProforma>
{
    public void Configure(EntityTypeBuilder<PurchaseProforma> builder)
    {
        builder.ToTable("proformas", "purchases");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(p => p.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(p => p.SupplierId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(p => p.ProformaNumber)
            .HasMaxLength(PurchaseProforma.NumberMaxLength)
            .IsRequired();

        builder.Property(p => p.IssueDate)
            .IsRequired();

        builder.Property(p => p.ExpirationDate);

        builder.Property(p => p.Status)
            .HasConversion<int>()
            .HasDefaultValue(PurchaseProformaStatus.Draft)
            .HasSentinel(default(PurchaseProformaStatus))
            .IsRequired();

        builder.Property(p => p.Currency)
            .HasMaxLength(PurchaseProforma.CurrencyMaxLength)
            .HasDefaultValue("USD")
            .IsRequired();

        builder.Property(p => p.Subtotal)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.TaxAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.TotalAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.AttachmentUrl)
            .HasMaxLength(PurchaseProforma.AttachmentUrlMaxLength);

        builder.Property(p => p.AttachmentFileName)
            .HasMaxLength(300);

        builder.Property(p => p.Notes)
            .HasMaxLength(PurchaseProforma.NotesMaxLength);

        builder.Property(p => p.ConvertedPurchaseId)
            .HasColumnType("uuid");

        builder.Property(p => p.CreatedAt)
            .IsRequired();

        builder.Property(p => p.UpdatedAt);
        builder.Property(p => p.CreatedBy).HasColumnType("uuid");
        builder.Property(p => p.UpdatedBy).HasColumnType("uuid");

        builder.HasIndex(p => new { p.TenantId, p.SupplierId, p.ProformaNumber })
            .IsUnique()
            .HasDatabaseName("ix_proformas_tenant_supplier_number_unique");

        builder.HasIndex(p => new { p.TenantId, p.Status })
            .HasDatabaseName("ix_proformas_tenant_status");

        builder.HasMany(p => p.Items)
            .WithOne(i => i.PurchaseProforma)
            .HasForeignKey(i => i.PurchaseProformaId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PurchaseProformaItemConfiguration : IEntityTypeConfiguration<PurchaseProformaItem>
{
    public void Configure(EntityTypeBuilder<PurchaseProformaItem> builder)
    {
        builder.ToTable("proforma_items", "purchases");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.PurchaseProformaId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.CatalogItemId)
            .HasColumnType("uuid");

        builder.Property(i => i.ExpenseTypeId)
            .HasColumnType("uuid");

        builder.Property(i => i.Description)
            .HasMaxLength(PurchaseProformaItem.DescriptionMaxLength)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(i => i.TaxRate)
            .HasPrecision(5, 2)
            .HasDefaultValue(15.00m)
            .IsRequired();

        builder.Property(i => i.LineTotal)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.HasIndex(i => i.PurchaseProformaId)
            .HasDatabaseName("ix_proforma_items_proforma_id");
    }
}
