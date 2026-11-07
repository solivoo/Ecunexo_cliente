using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;
using EcuNexo.Business.Ecommerce.Storefront.Queries.CalculateStorefrontQuote;

namespace EcuNexo.Api.Contracts.V1.Storefront;

public sealed record CalculateStorefrontQuoteRequest(
    IReadOnlyList<CreateStorefrontOrderItemInput> Items,
    string? ShippingMethod = null,
    string? CouponCode = null)
{
    public CalculateStorefrontQuoteQuery ToQuery(Guid tenantId) =>
        new(
            tenantId,
            Items ?? [],
            ShippingMethod,
            CouponCode);
}
