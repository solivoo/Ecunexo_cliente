using EcuNexo.Core.Catalog;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class StorefrontProductLikeConfiguration : IEntityTypeConfiguration<StorefrontProductLike>
{
    public void Configure(EntityTypeBuilder<StorefrontProductLike> builder)
    {
        builder.ToTable("product_likes", "ecommerce");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(l => l.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(l => l.CatalogItemId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<CatalogItem>()
            .WithMany()
            .HasForeignKey(l => l.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(l => l.VisitorId)
            .HasMaxLength(StorefrontProductLike.VisitorIdMaxLength)
            .IsRequired();

        builder.Property(l => l.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.HasIndex(l => new { l.TenantId, l.CatalogItemId, l.VisitorId })
            .IsUnique();

        builder.HasIndex(l => new { l.TenantId, l.CreatedAt });
    }
}
