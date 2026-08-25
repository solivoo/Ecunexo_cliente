using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed record SelectTenantBrandLogosCommand(
    Guid TenantId,
    Guid? LightLogoId,
    Guid? DarkLogoId,
    bool PreferWordmark) : ICommand<SelectTenantBrandLogosResponse>;

public sealed record SelectTenantBrandLogosResponse(
    Guid? LightLogoId,
    Guid? DarkLogoId,
    bool PreferWordmark,
    string? LogoUrl);
