using EcuNexo.Business.Tenancy.Commands;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record OnboardTenantWithActivationRequest(
    string ActivationCode,
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
    public OnboardTenantWithActivationCommand ToCommand() =>
        new(
            ActivationCode,
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
