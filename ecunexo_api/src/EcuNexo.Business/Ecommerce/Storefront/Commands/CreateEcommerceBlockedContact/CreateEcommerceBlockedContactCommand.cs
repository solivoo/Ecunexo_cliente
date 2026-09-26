using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateEcommerceBlockedContact;

public sealed record CreateEcommerceBlockedContactCommand(
    Guid TenantId,
    string Kind,
    string Value,
    string? Reason = null,
    Guid? CreatedBy = null) : ICommand<EcommerceBlockedContactDto>;
