using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EcuNexo.Data.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants", "tenancy");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnType("uuid")
            .ValueGeneratedNever();

        builder.Property(t => t.Name)
            .HasMaxLength(Tenant.MaxNameLength)
            .IsRequired();

        builder.Property(t => t.TimeZoneId)
            .HasMaxLength(Tenant.TimeZoneIdMaxLength);

        builder.Property(t => t.Locale)
            .HasMaxLength(Tenant.LocaleMaxLength);

        builder.Property(t => t.LogoUrl)
            .HasMaxLength(Tenant.LogoUrlMaxLength);

        builder.Property(t => t.LogoLightId)
            .HasColumnName("logo_light_id")
            .HasColumnType("uuid");

        builder.Property(t => t.LogoDarkId)
            .HasColumnName("logo_dark_id")
            .HasColumnType("uuid");

        builder.Property(t => t.PreferWordmark)
            .HasColumnName("prefer_wordmark")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(t => t.PrimaryColorHex)
            .HasMaxLength(Tenant.PrimaryColorHexMaxLength);

        builder.Property(t => t.TaxId)
            .HasColumnName("tax_id")
            .HasMaxLength(Tenant.TaxIdMaxLength);

        builder.Property(t => t.LegalName)
            .HasColumnName("legal_name")
            .HasMaxLength(Tenant.LegalNameMaxLength);

        builder.Property(t => t.City)
            .HasColumnName("city")
            .HasMaxLength(Tenant.CityMaxLength);

        builder.Property(t => t.EstablishmentCode)
            .HasColumnName("establishment_code")
            .HasMaxLength(Tenant.EstablishmentCodeMaxLength);

        builder.Property(t => t.Address)
            .HasColumnName("address")
            .HasMaxLength(Tenant.AddressMaxLength);

        builder.Property(t => t.ContactEmail)
            .HasColumnName("contact_email")
            .HasMaxLength(Tenant.ContactEmailMaxLength);

        builder.Property(t => t.ContactPhone)
            .HasColumnName("contact_phone")
            .HasMaxLength(Tenant.ContactPhoneMaxLength);

        builder.Property(t => t.RideThankYouText)
            .HasColumnName("ride_thank_you_text")
            .HasMaxLength(Tenant.RideThankYouTextMaxLength);

        builder.Property(t => t.AccountingRequired)
            .HasColumnName("accounting_required")
            .IsRequired();

        builder.Property(t => t.RimpeKind)
            .HasColumnName("rimpe_kind")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(t => t.IsRimpe)
            .HasColumnName("is_rimpe")
            .IsRequired();

        builder.Property(t => t.PreferElectronicInvoice)
            .HasColumnName("prefer_electronic_invoice")
            .IsRequired();

        builder.Property(t => t.IsExporter)
            .HasColumnName("is_exporter")
            .IsRequired();

        builder.Property(t => t.IsLargeTaxpayer)
            .HasColumnName("is_large_taxpayer")
            .IsRequired();

        builder.Property(t => t.IsSpecialTaxpayer)
            .HasColumnName("is_special_taxpayer")
            .IsRequired();

        builder.Property(t => t.IsWithholdingAgent)
            .HasColumnName("is_withholding_agent")
            .IsRequired();

        builder.HasIndex(t => t.TaxId)
            .HasDatabaseName("ix_tenants_tax_id");

        builder.Property(t => t.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.ComplexProperty(t => t.ServicePlan, plan =>
        {
            plan.IsRequired();

            plan.Property(p => p.Name)
                .HasColumnName("plan_name")
                .HasMaxLength(ServicePlan.MaxNameLength)
                .IsRequired();

            plan.Property(p => p.MaxUsers)
                .HasColumnName("plan_max_users");

            plan.Property(p => p.MaxWarehouses)
                .HasColumnName("plan_max_warehouses");
        });

        builder.Property(t => t.SubscriptionGroupId)
            .HasColumnName("subscription_group_id")
            .HasColumnType("uuid")
            .IsRequired();

        builder.HasIndex(t => t.SubscriptionGroupId)
            .HasDatabaseName("ix_tenants_subscription_group_id");

        builder.Property(t => t.SubscriptionMaxTenants)
            .HasColumnName("subscription_max_tenants")
            .IsRequired();

        builder.Property(t => t.EnabledModuleCodes)
            .HasColumnName("enabled_modules")
            .HasColumnType("jsonb");

        builder.Property(t => t.ModuleEntitlements)
            .HasColumnName("module_entitlements")
            .HasColumnType("jsonb");

        builder.Property(t => t.CreatedAt)
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnType("timestamptz");

        builder.Property(t => t.CreatedBy)
            .HasColumnType("uuid");

        builder.Property(t => t.UpdatedBy)
            .HasColumnType("uuid");

        builder.Property<uint>("xmin")
            .IsRowVersion()
            .HasColumnName("xmin");
    }
}
