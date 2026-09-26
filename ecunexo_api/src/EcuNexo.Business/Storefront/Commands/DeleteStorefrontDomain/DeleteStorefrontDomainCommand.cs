using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Commands.DeleteStorefrontDomain;

public sealed record DeleteStorefrontDomainCommand(
    Guid TenantId,
    Guid DomainId,
    Guid? UserId) : ICommand<bool>;
