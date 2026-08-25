using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class TenantBrandLogoConfiguration : IEntityTypeConfiguration<TenantBrandLogo>
{
    public void Configure(EntityTypeBuilder<TenantBrandLogo> builder)
    {
        builder.ToTable("tenant_brand_logos", "tenancy");

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

        builder.Property(x => x.OriginalFileName)
            .HasMaxLength(TenantBrandLogo.FileNameMaxLength)
            .IsRequired();

        builder.Property(x => x.Extension)
            .HasMaxLength(TenantBrandLogo.ExtensionMaxLength)
            .IsRequired();

        builder.Property(x => x.ContentType)
            .HasMaxLength(TenantBrandLogo.ContentTypeMaxLength)
            .IsRequired();

        builder.Property(x => x.ByteSize)
            .IsRequired();

        builder.Property(x => x.ImageBytes)
            .HasColumnType("bytea")
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(x => x.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(x => x.UpdatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(x => x.TenantId)
            .HasDatabaseName("ix_tenant_brand_logos_tenant_id");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
