using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class InvoiceStockEgressConfiguration : IEntityTypeConfiguration<InvoiceStockEgress>
{
    public void Configure(EntityTypeBuilder<InvoiceStockEgress> builder)
    {
        builder.ToTable("invoice_stock_egresses", "inventory");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(e => e.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(e => e.Tenant)
            .WithMany()
            .HasForeignKey(e => e.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(e => e.BillingInvoiceId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(e => e.InventoryDocumentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(e => new { e.TenantId, e.BillingInvoiceId })
            .IsUnique();
    }
}
