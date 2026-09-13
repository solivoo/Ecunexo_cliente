using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class TenantSigningCertificateConfiguration : IEntityTypeConfiguration<TenantSigningCertificate>
{
    public void Configure(EntityTypeBuilder<TenantSigningCertificate> builder)
    {
        builder.ToTable("tenant_signing_certificates", "tenancy");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.EncryptedData)
            .HasColumnType("bytea")
            .IsRequired();

        builder.Property(x => x.EncryptedPassword)
            .HasColumnType("bytea")
            .IsRequired();

        builder.Property(x => x.Nonce)
            .HasColumnType("bytea")
            .IsRequired();

        builder.Property(x => x.Tag)
            .HasColumnType("bytea")
            .IsRequired();

        builder.Property(x => x.Subject)
            .HasMaxLength(TenantSigningCertificate.SubjectMaxLength)
            .IsRequired();

        builder.Property(x => x.SubjectTaxId)
            .HasMaxLength(TenantSigningCertificate.SubjectTaxIdMaxLength);

        builder.Property(x => x.Issuer)
            .HasMaxLength(TenantSigningCertificate.IssuerMaxLength)
            .IsRequired();

        builder.Property(x => x.ValidFrom)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.ValidTo)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.SerialNumber)
            .HasMaxLength(TenantSigningCertificate.SerialNumberMaxLength);

        builder.Property(x => x.OriginalFileName)
            .HasMaxLength(255);

        builder.Property(x => x.IsActive)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedBy)
            .HasMaxLength(200);

        builder.Property(x => x.UpdatedBy)
            .HasMaxLength(200);

        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => new { x.TenantId, x.IsActive });
    }
}
