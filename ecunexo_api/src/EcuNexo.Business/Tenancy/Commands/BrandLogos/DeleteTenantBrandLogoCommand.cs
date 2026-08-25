using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed record DeleteTenantBrandLogoCommand(Guid TenantId, Guid LogoId)
    : ICommand<DeleteTenantBrandLogoResponse>;

public sealed record DeleteTenantBrandLogoResponse(Guid LogoId);
