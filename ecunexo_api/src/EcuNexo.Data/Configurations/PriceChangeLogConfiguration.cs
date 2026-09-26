using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PriceChangeLogConfiguration : IEntityTypeConfiguration<PriceChangeLog>
{
    public void Configure(EntityTypeBuilder<PriceChangeLog> builder)
    {
        builder.ToTable("price_change_log", "pricing");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(l => l.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(l => l.PriceListId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(l => l.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<PriceList>()
            .WithMany()
            .HasForeignKey(l => l.PriceListId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<CatalogItem>()
            .WithMany()
            .HasForeignKey(l => l.CatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(l => l.PreviousPrice)
            .HasColumnType("numeric(18,6)");

        builder.Property(l => l.NewPrice)
            .HasColumnType("numeric(18,6)");

        builder.Property(l => l.ValidFrom)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(l => l.ValidTo)
            .HasColumnType("date");

        builder.Property(l => l.Reason)
            .HasMaxLength(PriceChangeLog.ReasonMaxLength);

        builder.Property(l => l.ChangedBy)
            .HasColumnType("uuid");

        builder.Property(l => l.ChangedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(l => new { l.TenantId, l.CatalogItemId, l.ChangedAt })
            .HasDatabaseName("ix_price_change_log_item_changed_at");

        builder.HasIndex(l => new { l.TenantId, l.PriceListId })
            .HasDatabaseName("ix_price_change_log_list");
    }
}
