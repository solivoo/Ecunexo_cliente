using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.ListProductPrices;

public sealed record ListProductPricesQuery(
    Guid TenantId,
    string? Search = null,
    Guid? PriceListId = null,
    Guid? CategoryId = null,
    DateOnly? Date = null,
    bool OnlyVigent = true) : IQuery<IReadOnlyList<ProductPriceListItemResponse>>;
