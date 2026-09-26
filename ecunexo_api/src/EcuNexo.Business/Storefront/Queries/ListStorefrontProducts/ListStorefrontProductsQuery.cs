using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;

public sealed record ListStorefrontProductsQuery(
    Guid TenantId,
    string? Search = null,
    Guid? CategoryId = null,
    string? Sort = null,
    int Page = 1,
    int PageSize = 24)
    : IQuery<StorefrontProductPageDto>;
