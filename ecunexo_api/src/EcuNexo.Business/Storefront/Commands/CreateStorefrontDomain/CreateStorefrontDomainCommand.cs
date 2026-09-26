using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.CreateStorefrontDomain;

public sealed record CreateStorefrontDomainCommand(
    Guid TenantId,
    string? Domain,
    Guid? UserId) : ICommand<StorefrontDomainDto>;
