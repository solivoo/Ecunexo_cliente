using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ResolveCart;

public sealed record ResolveCartQuery(
    Guid TenantId,
    IReadOnlyList<CartPricingLineRequest> Lines,
    DateOnly Date,
    Guid? PriceListId = null,
    string? CouponCode = null,
    bool? PricesIncludeTaxOverride = null) : IQuery<CartPricingResult>;

public sealed class ResolveCartHandler : IQueryHandler<ResolveCartQuery, CartPricingResult>
{
    private readonly IPricingService _pricingService;

    public ResolveCartHandler(IPricingService pricingService)
    {
        _pricingService = pricingService;
    }

    public Task<Result<CartPricingResult>> Handle(ResolveCartQuery query, CancellationToken ct) =>
        _pricingService.ResolveCartAsync(
            query.TenantId,
            new CartPricingRequest(
                query.Lines,
                query.Date,
                query.PriceListId,
                query.CouponCode,
                query.PricesIncludeTaxOverride),
            ct);
}
