using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class TenantApiKeyConfiguration : IEntityTypeConfiguration<TenantApiKey>
{
    public void Configure(EntityTypeBuilder<TenantApiKey> builder)
    {
        builder.ToTable("tenant_api_keys", "identity");

        builder.HasKey(k => k.Id);

        builder.Property(k => k.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(k => k.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne(k => k.Tenant)
            .WithMany()
            .HasForeignKey(k => k.TenantId)
            .HasPrincipalKey(t => t.Id)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(k => k.Name)
            .HasMaxLength(TenantApiKey.NameMaxLength)
            .IsRequired();

        builder.Property(k => k.KeyPrefix)
            .HasMaxLength(TenantApiKey.KeyPrefixMaxLength)
            .IsRequired();

        builder.Property(k => k.KeyHash)
            .HasMaxLength(TenantApiKey.KeyHashLength)
            .IsRequired();

        builder.Property(k => k.Scopes)
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(k => k.ExpiresAt)
            .HasColumnType("timestamptz");

        builder.Property(k => k.RevokedAt)
            .HasColumnType("timestamptz");

        builder.Property(k => k.RevokedBy)
            .HasColumnType("uuid");

        builder.Property(k => k.LastUsedAt)
            .HasColumnType("timestamptz");

        builder.Property(k => k.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(k => k.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(k => k.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(k => k.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property(k => k.DeletedAt)
            .HasColumnType("timestamptz");

        builder.Property(k => k.DeletedBy)
            .HasColumnType("uuid");

        builder.HasIndex(k => k.KeyPrefix)
            .IsUnique()
            .HasDatabaseName("ix_tenant_api_keys_key_prefix");

        builder.HasIndex(k => new { k.TenantId, k.CreatedAt })
            .HasDatabaseName("ix_tenant_api_keys_tenant_created");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
