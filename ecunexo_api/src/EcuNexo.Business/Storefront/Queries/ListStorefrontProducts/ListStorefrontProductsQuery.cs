using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;

public sealed record ListStorefrontProductsQuery(
    Guid TenantId,
    string? Search = null,
    string? Sort = null,
    int Page = 1,
    int PageSize = 24,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? Facets = null,
    decimal? PriceMin = null,
    decimal? PriceMax = null,
    bool InStock = false,
    bool New = false)
    : IQuery<StorefrontProductPageDto>;
