using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.VerifyStorefrontDomain;

public sealed record VerifyStorefrontDomainCommand(
    Guid TenantId,
    Guid DomainId,
    Guid? UserId) : ICommand<StorefrontDomainDto>;
