using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class InventoryDocumentLineConfiguration : IEntityTypeConfiguration<InventoryDocumentLine>
{
    public void Configure(EntityTypeBuilder<InventoryDocumentLine> builder)
    {
        builder.ToTable("document_lines", "inventory");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(l => l.DocumentId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(l => l.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<EcuNexo.Core.Catalog.CatalogItem>()
            .WithMany()
            .HasForeignKey(l => l.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(l => l.Quantity)
            .HasColumnType("numeric(18,4)")
            .IsRequired();

        builder.HasIndex(l => l.DocumentId);
        builder.HasIndex(l => l.CatalogItemId);
    }
}
