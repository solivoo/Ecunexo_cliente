using EcuNexo.Business.Pricing;
using EcuNexo.Business.Pricing.Queries.ResolveCart;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record ResolveCartLineRequest(
    Guid CatalogItemId,
    decimal Quantity,
    Guid? LineId = null);

public sealed record ResolveCartRequest(
    IReadOnlyList<ResolveCartLineRequest> Lines,
    DateOnly? Date = null,
    Guid? PriceListId = null,
    string? CouponCode = null,
    bool? PricesIncludeTaxOverride = null)
{
    public ResolveCartQuery ToQuery(Guid tenantId) =>
        new(
            tenantId,
            Lines.Select(l => new CartPricingLineRequest(l.CatalogItemId, l.Quantity, l.LineId)).ToList(),
            Date ?? DateOnly.FromDateTime(DateTime.UtcNow),
            PriceListId,
            CouponCode,
            PricesIncludeTaxOverride);
}
