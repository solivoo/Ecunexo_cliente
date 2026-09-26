using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.RemoveEcommerceBlockedContact;

public sealed record RemoveEcommerceBlockedContactCommand(
    Guid TenantId,
    Guid ContactId) : ICommand<bool>;
