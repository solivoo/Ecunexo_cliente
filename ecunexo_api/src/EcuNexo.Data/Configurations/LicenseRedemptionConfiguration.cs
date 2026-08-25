using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class LicenseRedemptionConfiguration : IEntityTypeConfiguration<LicenseRedemption>
{
    public void Configure(EntityTypeBuilder<LicenseRedemption> builder)
    {
        builder.ToTable("license_redemptions", "tenancy");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnType("uuid").ValueGeneratedNever();
        builder.Property(x => x.SubscriptionAccountId).HasColumnType("uuid").IsRequired();
        builder.HasIndex(x => x.SubscriptionAccountId)
            .HasDatabaseName("ix_license_redemptions_subscription_account_id");
        builder.Property(x => x.RedeemedAtUtc).HasColumnType("timestamptz").IsRequired();
    }
}
