using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontDomains;

public sealed record ListStorefrontDomainsQuery(Guid TenantId)
    : IQuery<IReadOnlyList<StorefrontDomainDto>>;
