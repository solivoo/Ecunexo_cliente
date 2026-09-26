using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ResolvePrice;

public sealed class ResolvePriceHandler : IQueryHandler<ResolvePriceQuery, PricingResult>
{
    private readonly IPricingService _pricing;

    public ResolvePriceHandler(IPricingService pricing)
    {
        _pricing = pricing;
    }

    public Task<Result<PricingResult>> Handle(ResolvePriceQuery query, CancellationToken ct) =>
        _pricing.ResolveAsync(
            query.TenantId,
            new PricingRequest(query.CatalogItemId, query.Quantity, query.Date, query.PriceListId),
            ct);
}
