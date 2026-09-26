using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateEcommerceBlockedContact;

namespace EcuNexo.Api.Contracts.V1.Storefront;

public sealed record CreateEcommerceBlockedContactRequest(
    string Kind,
    string Value,
    string? Reason = null)
{
    public CreateEcommerceBlockedContactCommand ToCommand(Guid tenantId, Guid? createdBy) =>
        new(tenantId, Kind, Value, Reason, createdBy);
}
