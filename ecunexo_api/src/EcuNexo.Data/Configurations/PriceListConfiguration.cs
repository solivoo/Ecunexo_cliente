using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class PriceListConfiguration : IEntityTypeConfiguration<PriceList>
{
    public void Configure(EntityTypeBuilder<PriceList> builder)
    {
        builder.ToTable("price_lists", "pricing");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(l => l.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(l => l.Tenant)
            .WithMany()
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(l => l.Code)
            .HasMaxLength(PriceList.CodeMaxLength)
            .IsRequired();

        builder.Property(l => l.Name)
            .HasMaxLength(PriceList.NameMaxLength)
            .IsRequired();

        builder.Property(l => l.Description)
            .HasMaxLength(PriceList.DescriptionMaxLength);

        builder.Property(l => l.Currency)
            .HasMaxLength(PriceList.CurrencyMaxLength)
            .IsRequired()
            .HasDefaultValue(PriceList.DefaultCurrency);

        builder.Property(l => l.PricesIncludeTax)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(l => l.ValidFrom)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(l => l.ValidTo)
            .HasColumnType("date");

        builder.Property(l => l.Priority)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(l => l.IsDefault)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(l => l.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(l => l.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(l => l.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(l => l.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(l => l.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(l => new { l.TenantId, l.Code })
            .IsUnique()
            .HasDatabaseName("ux_price_lists_tenant_code");

        builder.HasIndex(l => l.TenantId)
            .IsUnique()
            .HasDatabaseName("ux_price_lists_tenant_default")
            .HasFilter("is_default AND is_active");

        builder.HasIndex(l => new { l.TenantId, l.IsActive });

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
