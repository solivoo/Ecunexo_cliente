using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.ListPriceLists;

public sealed record ListPriceListsQuery(Guid TenantId, bool OnlyActive = true)
    : IQuery<IReadOnlyList<PriceListResponse>>;
