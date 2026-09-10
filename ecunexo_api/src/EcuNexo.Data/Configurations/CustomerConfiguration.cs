using EcuNexo.Core.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers", "repairs");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(c => c.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasMaxLength(Customer.NameMaxLength)
            .IsRequired();

        builder.Property(c => c.TaxId)
            .HasMaxLength(Customer.TaxIdMaxLength);

        builder.Property(c => c.CustomerType)
            .HasConversion<int>()
            .HasDefaultValue(EcuNexo.Core.Customers.CustomerType.CorporativoB2B)
            .HasSentinel(default(EcuNexo.Core.Customers.CustomerType))
            .IsRequired();

        builder.Property(c => c.IdentificationType)
            .HasConversion<int>()
            .HasDefaultValue(EcuNexo.Core.Customers.CustomerIdentificationType.Ruc)
            .HasSentinel(default(EcuNexo.Core.Customers.CustomerIdentificationType))
            .IsRequired();

        builder.Property(c => c.ContactEmail)
            .HasMaxLength(120);

        builder.Property(c => c.ContactPhone)
            .HasMaxLength(40);

        builder.Property(c => c.Address)
            .HasMaxLength(300);

        builder.Property(c => c.ContactPerson)
            .HasMaxLength(120);

        builder.Property(c => c.Notes)
            .HasMaxLength(500);

        builder.Property(c => c.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(c => c.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(c => c.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(c => c.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(c => c.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .HasFilter("\"deleted_at\" IS NULL");
        builder.HasIndex(c => new { c.TenantId, c.TaxId })
            .HasFilter("\"deleted_at\" IS NULL");
        builder.HasIndex(c => new { c.TenantId, c.CustomerType })
            .HasFilter("\"deleted_at\" IS NULL");
    }
}
