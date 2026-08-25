using EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record ProvisionSubscriptionCompanyRequest(
    string TenantName,
    string OwnerEmail,
    string OwnerName,
    string OwnerPassword,
    string? TimeZoneId = null,
    string? Locale = null,
    string? LogoUrl = null,
    string? PrimaryColorHex = null,
    string? OwnerDepartment = null,
    string? OwnerPhone = null,
    string? OwnerJobTitle = null)
{
    public ProvisionSubscriptionCompanyCommand ToCommand(Guid subscriptionAccountId) =>
        new(
            subscriptionAccountId,
            TenantName,
            OwnerEmail,
            OwnerName,
            OwnerPassword,
            TimeZoneId,
            Locale,
            LogoUrl,
            PrimaryColorHex,
            OwnerDepartment,
            OwnerPhone,
            OwnerJobTitle);
}
