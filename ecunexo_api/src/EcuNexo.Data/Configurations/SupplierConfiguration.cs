using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("suppliers", "purchases");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(s => s.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(s => s.BusinessName)
            .HasMaxLength(Supplier.NameMaxLength)
            .IsRequired();

        builder.Property(s => s.TradeName)
            .HasMaxLength(Supplier.TradeNameMaxLength);

        builder.Property(s => s.IdentificationType)
            .HasConversion<int>()
            .HasDefaultValue(SupplierIdentificationType.Ruc)
            .HasSentinel(default(SupplierIdentificationType))
            .IsRequired();

        builder.Property(s => s.TaxId)
            .HasMaxLength(Supplier.TaxIdMaxLength)
            .IsRequired();

        builder.Property(s => s.TaxRegime)
            .HasConversion<int>()
            .HasDefaultValue(SupplierTaxRegime.General)
            .HasSentinel(default(SupplierTaxRegime))
            .IsRequired();

        builder.Property(s => s.IsRetentionAgent)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(s => s.ResolutionNumber)
            .HasMaxLength(100);

        builder.Property(s => s.ContactEmail)
            .HasMaxLength(Supplier.EmailMaxLength);

        builder.Property(s => s.ContactPhone)
            .HasMaxLength(Supplier.PhoneMaxLength);

        builder.Property(s => s.Address)
            .HasMaxLength(Supplier.AddressMaxLength);

        builder.Property(s => s.ContactPerson)
            .HasMaxLength(Supplier.NameMaxLength);

        builder.Property(s => s.CreditDays)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(s => s.CreditLimit)
            .HasPrecision(18, 2);

        builder.Property(s => s.BankName)
            .HasMaxLength(Supplier.BankMaxLength);

        builder.Property(s => s.BankAccountType)
            .HasMaxLength(50);

        builder.Property(s => s.BankAccountNumber)
            .HasMaxLength(Supplier.BankAccountMaxLength);

        builder.Property(s => s.Notes)
            .HasMaxLength(1000);

        builder.Property(s => s.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(s => s.CreatedAt)
            .IsRequired();

        builder.Property(s => s.UpdatedAt);
        builder.Property(s => s.CreatedBy).HasColumnType("uuid");
        builder.Property(s => s.UpdatedBy).HasColumnType("uuid");
        builder.Property(s => s.DeletedAt);
        builder.Property(s => s.DeletedBy).HasColumnType("uuid");

        builder.HasIndex(s => new { s.TenantId, s.TaxId })
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName("ix_suppliers_tenant_tax_id_unique");

        builder.HasIndex(s => new { s.TenantId, s.IsActive })
            .HasDatabaseName("ix_suppliers_tenant_active");

        builder.HasMany(s => s.Proformas)
            .WithOne(p => p.Supplier)
            .HasForeignKey(p => p.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
