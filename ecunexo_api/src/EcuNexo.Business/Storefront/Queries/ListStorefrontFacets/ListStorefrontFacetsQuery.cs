using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontFacets;

public sealed record ListStorefrontFacetsQuery(Guid TenantId) : IQuery<StorefrontFacetsDto>;
