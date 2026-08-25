using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Queries.GetTenantById;

internal static class TenantDetailMapper
{
    public static GetTenantByIdResponse Map(Tenant tenant)
    {
        var plan = tenant.ServicePlan;
        return new GetTenantByIdResponse(
            tenant.Id,
            tenant.Name,
            tenant.TimeZoneId,
            tenant.Locale,
            tenant.LogoUrl,
            tenant.PrimaryColorHex,
            tenant.TaxId,
            tenant.LegalName,
            tenant.City,
            tenant.EstablishmentCode,
            tenant.Address,
            tenant.AccountingRequired,
            tenant.IsRimpe,
            tenant.RimpeKind.ToApiCode(),
            tenant.PreferElectronicInvoice,
            tenant.ResolveSalesDocumentKind().ToApiCode(),
            tenant.IsExporter,
            tenant.IsLargeTaxpayer,
            tenant.IsSpecialTaxpayer,
            tenant.IsWithholdingAgent,
            tenant.ContactEmail,
            tenant.ContactPhone,
            tenant.RideThankYouText,
            tenant.LogoLightId,
            tenant.LogoDarkId,
            tenant.PreferWordmark,
            tenant.LogoLightId is { } light
                ? $"/api/v1/tenants/{tenant.Id}/brand-logos/{light}/file"
                : null,
            tenant.LogoDarkId is { } dark
                ? $"/api/v1/tenants/{tenant.Id}/brand-logos/{dark}/file"
                : null,
            tenant.Status,
            plan.Name,
            plan.MaxUsers,
            plan.MaxWarehouses,
            tenant.SubscriptionMaxTenants,
            tenant.EnabledModuleCodes,
            tenant.CreatedAt,
            tenant.UpdatedAt);
    }
}
