using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class StorefrontDomainConfiguration : IEntityTypeConfiguration<StorefrontDomain>
{
    public void Configure(EntityTypeBuilder<StorefrontDomain> builder)
    {
        builder.ToTable("storefront_domains", "tenancy");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.Domain)
            .HasMaxLength(StorefrontDomain.DomainMaxLength)
            .IsRequired();

        builder.Property(x => x.IsPrimary)
            .IsRequired();

        builder.Property(x => x.VerificationToken)
            .HasMaxLength(StorefrontDomain.TokenMaxLength)
            .IsRequired();

        builder.Property(x => x.VerifiedAt)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(x => x.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(x => x.Domain)
            .IsUnique()
            .HasDatabaseName("ux_storefront_domains_domain");

        builder.HasIndex(x => x.TenantId)
            .HasDatabaseName("ix_storefront_domains_tenant_id");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
