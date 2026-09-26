using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.ResolvePrice;

public sealed record ResolvePriceQuery(
    Guid TenantId,
    Guid CatalogItemId,
    decimal Quantity,
    DateOnly Date,
    Guid? PriceListId = null) : IQuery<PricingResult>;
