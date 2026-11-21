using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class StockReservationConfiguration : IEntityTypeConfiguration<StockReservation>
{
    public void Configure(EntityTypeBuilder<StockReservation> builder)
    {
        builder.ToTable("stock_reservations", "ecommerce");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnType("uuid").ValueGeneratedNever();
        builder.Property(r => r.TenantId).HasColumnType("uuid").IsRequired();
        builder.Property(r => r.ReservationNumber).HasMaxLength(StockReservation.ReservationNumberMaxLength).IsRequired();
        builder.Property(r => r.WarehouseId).HasColumnType("uuid").IsRequired();
        builder.Property(r => r.CustomerId).HasColumnType("uuid").IsRequired();
        builder.Property(r => r.CustomerName).HasMaxLength(StockReservation.CustomerNameMaxLength).IsRequired();
        builder.Property(r => r.CustomerTaxId).HasMaxLength(StockReservation.CustomerTaxIdMaxLength).IsRequired();
        builder.Property(r => r.CustomerEmail).HasMaxLength(200);
        builder.Property(r => r.CustomerPhone).HasMaxLength(40);
        builder.Property(r => r.Status).HasConversion<int>().IsRequired();
        builder.Property(r => r.ReservedAtUtc).HasColumnType("timestamptz").IsRequired();
        builder.Property(r => r.ExpiresAtUtc).HasColumnType("timestamptz");
        builder.Property(r => r.Subtotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(r => r.TaxAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(r => r.TotalAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(r => r.PaidAmount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(r => r.BillingInvoiceId).HasColumnType("uuid");
        builder.Property(r => r.InvoiceObservation).HasMaxLength(StockReservation.ObservationMaxLength);
        builder.Property(r => r.Notes).HasMaxLength(StockReservation.NotesMaxLength);
        builder.Property(r => r.InvoicedAtUtc).HasColumnType("timestamptz");
        builder.Property(r => r.CancelledAtUtc).HasColumnType("timestamptz");
        builder.Property(r => r.CancellationReason).HasMaxLength(500);
        builder.Property<uint>("xmin").IsRowVersion();

        builder.Ignore(r => r.BalanceAmount);
        builder.Ignore(r => r.IsFullyPaid);

        builder.HasOne(r => r.Warehouse)
            .WithMany()
            .HasForeignKey(r => r.WarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Customer)
            .WithMany()
            .HasForeignKey(r => r.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(r => r.Items)
            .WithOne()
            .HasForeignKey(i => i.StockReservationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(r => r.Payments)
            .WithOne()
            .HasForeignKey(p => p.StockReservationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(r => r.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(r => r.Payments).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(r => new { r.TenantId, r.ReservationNumber }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.Status });
        builder.HasIndex(r => new { r.TenantId, r.CustomerId });
    }
}

public sealed class StockReservationItemConfiguration : IEntityTypeConfiguration<StockReservationItem>
{
    public void Configure(EntityTypeBuilder<StockReservationItem> builder)
    {
        builder.ToTable("stock_reservation_items", "ecommerce");

        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).HasColumnType("uuid").ValueGeneratedNever();
        builder.Property(i => i.StockReservationId).HasColumnType("uuid").IsRequired();
        builder.Property(i => i.CatalogItemId).HasColumnType("uuid").IsRequired();
        builder.Property(i => i.Sku).HasMaxLength(100).IsRequired();
        builder.Property(i => i.ItemName).HasMaxLength(250).IsRequired();
        builder.Property(i => i.Quantity).HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(i => i.UnitPrice).HasColumnType("numeric(18,4)").IsRequired();
        builder.Property(i => i.TaxRate).HasColumnType("numeric(7,4)").IsRequired();
        builder.Property(i => i.LineSubtotal).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(i => i.LineTax).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(i => i.LineTotal).HasColumnType("numeric(18,2)").IsRequired();
    }
}

public sealed class StockReservationPaymentConfiguration : IEntityTypeConfiguration<StockReservationPayment>
{
    public void Configure(EntityTypeBuilder<StockReservationPayment> builder)
    {
        builder.ToTable("stock_reservation_payments", "ecommerce");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnType("uuid").ValueGeneratedNever();
        builder.Property(p => p.StockReservationId).HasColumnType("uuid").IsRequired();
        builder.Property(p => p.Amount).HasColumnType("numeric(18,2)").IsRequired();
        builder.Property(p => p.PaymentMethod).HasConversion<int>().IsRequired();
        builder.Property(p => p.Reference).HasMaxLength(StockReservation.ReferenceMaxLength);
        builder.Property(p => p.Notes).HasMaxLength(StockReservation.NotesMaxLength);
        builder.Property(p => p.ProofObjectKey).HasMaxLength(StockReservation.ProofObjectKeyMaxLength);
        builder.Property(p => p.ProofContentType).HasMaxLength(StockReservation.ProofContentTypeMaxLength);
        builder.Property(p => p.PaidAtUtc).HasColumnType("timestamptz").IsRequired();
        builder.Property(p => p.RecordedBy).HasColumnType("uuid");
    }
}
