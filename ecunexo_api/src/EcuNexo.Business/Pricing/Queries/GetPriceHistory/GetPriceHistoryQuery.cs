using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.GetPriceHistory;

public sealed record GetPriceHistoryQuery(
    Guid TenantId,
    Guid? CatalogItemId = null,
    Guid? PriceListId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null) : IQuery<IReadOnlyList<PriceHistoryItemResponse>>;
