using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcommerceOrderConfiguration : IEntityTypeConfiguration<EcommerceOrder>
{
    public void Configure(EntityTypeBuilder<EcommerceOrder> builder)
    {
        builder.ToTable("orders", "ecommerce");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(o => o.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(o => o.Tenant)
            .WithMany()
            .HasForeignKey(o => o.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(o => o.WarehouseId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(o => o.Warehouse)
            .WithMany()
            .HasForeignKey(o => o.WarehouseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(o => o.OrderNumber)
            .HasMaxLength(EcommerceOrder.OrderNumberMaxLength)
            .IsRequired();

        builder.Property(o => o.OrderDate)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(o => o.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(o => o.PaymentStatus)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(o => o.PaymentMethod)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(o => o.PaymentReference)
            .HasMaxLength(EcommerceOrder.PaymentReferenceMaxLength);

        builder.Property(o => o.ShippingMethod)
            .HasConversion<int>()
            .IsRequired();

        builder.ComplexProperty(o => o.Customer, c =>
        {
            c.Property(p => p.CustomerName).HasColumnName("customer_name").HasMaxLength(200).IsRequired();
            c.Property(p => p.TaxId).HasColumnName("customer_tax_id").HasMaxLength(20).IsRequired();
            c.Property(p => p.TaxIdType).HasColumnName("customer_tax_id_type").HasMaxLength(10);
            c.Property(p => p.Email).HasColumnName("customer_email").HasMaxLength(200).IsRequired();
            c.Property(p => p.Phone).HasColumnName("customer_phone").HasMaxLength(50);
            c.Property(p => p.Address).HasColumnName("customer_address").HasMaxLength(500);
        });

        builder.ComplexProperty(o => o.Shipping, s =>
        {
            s.Property(p => p.RecipientName).HasColumnName("shipping_recipient_name").HasMaxLength(200).IsRequired();
            s.Property(p => p.RecipientPhone).HasColumnName("shipping_recipient_phone").HasMaxLength(50);
            s.Property(p => p.AddressLine1).HasColumnName("shipping_address_line1").HasMaxLength(300).IsRequired();
            s.Property(p => p.AddressLine2).HasColumnName("shipping_address_line2").HasMaxLength(300);
            s.Property(p => p.City).HasColumnName("shipping_city").HasMaxLength(100).IsRequired();
            s.Property(p => p.Province).HasColumnName("shipping_province").HasMaxLength(100);
            s.Property(p => p.PostalCode).HasColumnName("shipping_postal_code").HasMaxLength(20);
            s.Property(p => p.Carrier).HasColumnName("shipping_carrier").HasMaxLength(100);
            s.Property(p => p.TrackingNumber).HasColumnName("shipping_tracking_number").HasMaxLength(100);
            s.Property(p => p.Notes).HasColumnName("shipping_notes").HasMaxLength(500);
        });

        builder.Property(o => o.Subtotal)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(o => o.DiscountAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(o => o.TaxAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(o => o.ShippingCost)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(o => o.TotalAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(o => o.BillingInvoiceId)
            .HasColumnType("uuid");

        builder.Property(o => o.EstimatedDeliveryDate)
            .HasColumnType("timestamptz");

        builder.Property(o => o.ShippedAt)
            .HasColumnType("timestamptz");

        builder.Property(o => o.DeliveredAt)
            .HasColumnType("timestamptz");

        builder.Property(o => o.CancelledAt)
            .HasColumnType("timestamptz");

        builder.Property(o => o.CancellationReason)
            .HasMaxLength(500);

        builder.Property(o => o.InternalNotes)
            .HasMaxLength(EcommerceOrder.NotesMaxLength);

        builder.Property(o => o.CustomerNotes)
            .HasMaxLength(EcommerceOrder.NotesMaxLength);

        builder.Property(o => o.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(o => o.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(o => o.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(o => o.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasMany(o => o.Items)
            .WithOne(i => i.EcommerceOrder)
            .HasForeignKey(i => i.EcommerceOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(o => o.Items)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(o => o.Timeline)
            .WithOne()
            .HasForeignKey(t => t.EcommerceOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(o => o.Timeline)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(o => new { o.TenantId, o.OrderNumber })
            .IsUnique();

        builder.HasIndex(o => new { o.TenantId, o.Status });
        builder.HasIndex(o => new { o.TenantId, o.OrderDate });
        builder.HasIndex(o => new { o.TenantId, o.BillingInvoiceId });
    }
}
