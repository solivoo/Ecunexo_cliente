using EcuNexo.Business.Tenancy.Commands;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record CreateTenantRequest(
    string Name,
    string ServicePlanName,
    int MaxUsers,
    int MaxWarehouses,
    string? TimeZoneId = null,
    string? Locale = null,
    string? LogoUrl = null,
    string? PrimaryColorHex = null)
{
    public CreateTenantCommand ToCommand() =>
        new(
            Name,
            ServicePlanName,
            MaxUsers,
            MaxWarehouses,
            TimeZoneId,
            Locale,
            LogoUrl,
            PrimaryColorHex);
}
