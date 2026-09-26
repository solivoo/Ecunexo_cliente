using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.ListEcommerceBlockedContacts;

public sealed record ListEcommerceBlockedContactsQuery(
    Guid TenantId) : IQuery<IReadOnlyList<EcommerceBlockedContactDto>>;
