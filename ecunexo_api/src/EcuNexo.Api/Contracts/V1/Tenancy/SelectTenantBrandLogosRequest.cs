using EcuNexo.Business.Tenancy.Commands.BrandLogos;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record SelectTenantBrandLogosRequest(
    Guid? LightLogoId,
    Guid? DarkLogoId,
    bool PreferWordmark)
{
    public SelectTenantBrandLogosCommand ToCommand(Guid tenantId) =>
        new(tenantId, LightLogoId, DarkLogoId, PreferWordmark);
}
