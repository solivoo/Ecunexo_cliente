using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Licensing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class SubscriptionAccountConfiguration : IEntityTypeConfiguration<SubscriptionAccount>
{
    public void Configure(EntityTypeBuilder<SubscriptionAccount> builder)
    {
        builder.ToTable("subscription_accounts", "tenancy");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(a => a.GrantId)
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasIndex(a => a.GrantId)
            .IsUnique()
            .HasDatabaseName("ix_subscription_accounts_grant_id");

        builder.Property(a => a.Email)
            .HasMaxLength(320)
            .IsRequired();

        builder.HasIndex(a => a.Email)
            .IsUnique()
            .HasDatabaseName("ix_subscription_accounts_email");

        builder.Property(a => a.Name)
            .HasMaxLength(SubscriptionAccount.NameMaxLength)
            .IsRequired();

        builder.Property(a => a.Department)
            .HasMaxLength(SubscriptionAccount.DepartmentMaxLength);

        builder.Property(a => a.Phone)
            .HasMaxLength(SubscriptionAccount.PhoneMaxLength);

        builder.Property(a => a.JobTitle)
            .HasMaxLength(SubscriptionAccount.JobTitleMaxLength);

        builder.Property(a => a.PasswordHash)
            .HasMaxLength(SubscriptionAccount.PasswordHashMaxLength)
            .IsRequired();

        builder.ComplexProperty(a => a.ServicePlan, plan =>
        {
            plan.IsRequired();
            plan.Property(p => p.Name).HasColumnName("plan_name").HasMaxLength(ServicePlan.MaxNameLength).IsRequired();
            plan.Property(p => p.MaxUsers).HasColumnName("plan_max_users");
            plan.Property(p => p.MaxWarehouses).HasColumnName("plan_max_warehouses");
        });

        builder.Property(a => a.SubscriptionMaxTenants)
            .HasColumnName("subscription_max_tenants")
            .IsRequired();

        builder.Property(a => a.EnabledModuleCodes)
            .HasColumnName("enabled_modules")
            .HasColumnType("jsonb");

        builder.Property(a => a.ModuleEntitlements)
            .HasColumnName("module_entitlements")
            .HasColumnType("jsonb");

        builder.Property(a => a.SubscriptionGroupId)
            .HasColumnName("subscription_group_id")
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasIndex(a => a.SubscriptionGroupId)
            .HasDatabaseName("ix_subscription_accounts_subscription_group_id");

        builder.Property(a => a.LicenseExpiresAtUtc)
            .HasColumnName("license_expires_at_utc")
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(a => a.OnlineValidationIntervalDays)
            .HasColumnName("online_validation_interval_days")
            .HasDefaultValue(LicenseValidationPolicy.DefaultIntervalDays)
            .IsRequired();

        builder.Property(a => a.LastOnlineLicenseValidationAtUtc)
            .HasColumnName("last_online_license_validation_at_utc")
            .HasColumnType("timestamptz");

        builder.Property(a => a.LastLoginAt).HasColumnType("timestamptz");
        builder.Property(a => a.CreatedAt).HasColumnType("timestamptz").IsRequired();
        builder.Property(a => a.UpdatedAt).HasColumnType("timestamptz");
        builder.Property(a => a.CreatedBy).HasColumnType("uuid");
        builder.Property(a => a.UpdatedBy).HasColumnType("uuid");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
