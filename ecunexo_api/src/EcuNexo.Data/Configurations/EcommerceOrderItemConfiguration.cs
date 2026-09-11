using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcommerceOrderItemConfiguration : IEntityTypeConfiguration<EcommerceOrderItem>
{
    public void Configure(EntityTypeBuilder<EcommerceOrderItem> builder)
    {
        builder.ToTable("order_items", "ecommerce");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(i => i.EcommerceOrderId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(i => i.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(i => i.CatalogItem)
            .WithMany()
            .HasForeignKey(i => i.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(i => i.Sku)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(i => i.ItemName)
            .HasMaxLength(250)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.Property(i => i.DiscountAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(i => i.TaxRate)
            .HasColumnType("numeric(6,4)")
            .IsRequired();

        builder.Property(i => i.TaxAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(i => i.TotalAmount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.HasIndex(i => i.EcommerceOrderId);
        builder.HasIndex(i => i.CatalogItemId);
    }
}
