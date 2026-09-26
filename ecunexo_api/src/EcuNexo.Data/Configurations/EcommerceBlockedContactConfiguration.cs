using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class EcommerceBlockedContactConfiguration : IEntityTypeConfiguration<EcommerceBlockedContact>
{
    public void Configure(EntityTypeBuilder<EcommerceBlockedContact> builder)
    {
        builder.ToTable("blocked_contacts", "ecommerce");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(c => c.TenantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasOne<Tenant>()
            .WithMany()
            .HasForeignKey(c => c.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(c => c.Kind)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(c => c.ValueNormalized)
            .HasMaxLength(EcommerceBlockedContact.ValueNormalizedMaxLength)
            .IsRequired();

        builder.Property(c => c.Reason)
            .HasMaxLength(EcommerceBlockedContact.ReasonMaxLength);

        builder.Property(c => c.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(c => c.CreatedBy)
            .HasColumnType("uuid");

        builder.HasIndex(c => new { c.TenantId, c.Kind, c.ValueNormalized })
            .IsUnique();
    }
}
