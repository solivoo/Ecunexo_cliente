using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.CalculateStorefrontQuote;

public sealed record CalculateStorefrontQuoteQuery(
    Guid TenantId,
    IReadOnlyList<CreateStorefrontOrderItemInput> Items,
    string? ShippingMethod = null,
    string? CouponCode = null)
    : IQuery<StorefrontCheckoutQuoteDto>;
