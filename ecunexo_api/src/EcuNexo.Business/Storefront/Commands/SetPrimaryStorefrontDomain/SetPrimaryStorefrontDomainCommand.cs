using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.SetPrimaryStorefrontDomain;

public sealed record SetPrimaryStorefrontDomainCommand(
    Guid TenantId,
    Guid DomainId,
    Guid? UserId) : ICommand<StorefrontDomainDto>;
