using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PurchaseConfiguration : IEntityTypeConfiguration<Purchase>
{
    public void Configure(EntityTypeBuilder<Purchase> builder)
    {
        builder.ToTable("purchases", "purchases");

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

        builder.Property(p => p.ExpenseTypeId)
            .HasColumnType("uuid");

        builder.Property(p => p.ProformaId)
            .HasColumnType("uuid");

        builder.Property(p => p.DocumentType)
            .HasMaxLength(Purchase.DocumentTypeMaxLength)
            .HasDefaultValue("01")
            .IsRequired();

        builder.Property(p => p.InvoiceNumber)
            .HasMaxLength(Purchase.InvoiceNumberMaxLength)
            .IsRequired();

        builder.Property(p => p.AuthorizationNumber)
            .HasMaxLength(Purchase.AuthorizationNumberMaxLength);

        builder.Property(p => p.IssueDate)
            .IsRequired();

        builder.Property(p => p.RegistrationDate)
            .IsRequired();

        builder.Property(p => p.SriSustentoCode)
            .HasMaxLength(Purchase.SriSustentoCodeMaxLength)
            .HasDefaultValue("01")
            .IsRequired();

        builder.Property(p => p.SubtotalZero)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.SubtotalTaxed)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.SubtotalNoSubject)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.SubtotalExempt)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.TaxRate)
            .HasPrecision(5, 2)
            .HasDefaultValue(15.00m)
            .IsRequired();

        builder.Property(p => p.TaxAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.TotalDiscount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.TotalAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.PaymentMethodCode)
            .HasMaxLength(Purchase.PaymentMethodMaxLength);

        builder.Property(p => p.CreditDays)
            .IsRequired();

        builder.Property(p => p.Status)
            .HasConversion<int>()
            .HasDefaultValue(PurchaseStatus.Draft)
            .HasSentinel(default(PurchaseStatus))
            .IsRequired();

        builder.Property(p => p.InventoryDocumentId)
            .HasColumnType("uuid");

        builder.Property(p => p.RawXml)
            .HasColumnType("text");

        builder.Property(p => p.Notes)
            .HasMaxLength(Purchase.NotesMaxLength);

        builder.Property(p => p.CreatedAt)
            .IsRequired();

        builder.Property(p => p.UpdatedAt);
        builder.Property(p => p.CreatedBy).HasColumnType("uuid");
        builder.Property(p => p.UpdatedBy).HasColumnType("uuid");

        builder.HasIndex(p => new { p.TenantId, p.SupplierId, p.InvoiceNumber })
            .IsUnique()
            .HasDatabaseName("ix_purchases_tenant_supplier_invoice_unique");

        builder.HasIndex(p => new { p.TenantId, p.AuthorizationNumber })
            .HasDatabaseName("ix_purchases_tenant_authorization");

        builder.HasIndex(p => new { p.TenantId, p.Status })
            .HasDatabaseName("ix_purchases_tenant_status");

        builder.HasIndex(p => new { p.TenantId, p.IssueDate })
            .HasDatabaseName("ix_purchases_tenant_issue_date");

        builder.HasMany(p => p.Items)
            .WithOne()
            .HasForeignKey(i => i.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PurchaseItemConfiguration : IEntityTypeConfiguration<PurchaseItem>
{
    public void Configure(EntityTypeBuilder<PurchaseItem> builder)
    {
        builder.ToTable("purchase_items", "purchases");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.PurchaseId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.CatalogItemId)
            .HasColumnType("uuid");

        builder.Property(i => i.WarehouseId)
            .HasColumnType("uuid");

        builder.Property(i => i.ItemCode)
            .HasMaxLength(PurchaseItem.ItemCodeMaxLength)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasMaxLength(PurchaseItem.DescriptionMaxLength)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(i => i.Discount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.Subtotal)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.TaxRate)
            .HasPrecision(5, 2)
            .HasDefaultValue(15.00m)
            .IsRequired();

        builder.Property(i => i.TaxAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.Total)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(i => i.AffectsInventory)
            .IsRequired();

        builder.HasIndex(i => i.PurchaseId)
            .HasDatabaseName("ix_purchase_items_purchase_id");

        builder.HasIndex(i => i.CatalogItemId)
            .HasDatabaseName("ix_purchase_items_catalog_item_id");
    }
}
