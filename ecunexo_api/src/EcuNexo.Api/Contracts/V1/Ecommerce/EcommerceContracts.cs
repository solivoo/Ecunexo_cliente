using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Api.Contracts.V1.Ecommerce;

public sealed record CreateEcommerceOrderItemRequest(
    Guid CatalogItemId,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount = 0m,
    decimal TaxRate = 0.15m)
{
    public CreateEcommerceOrderItemInput ToInput() =>
        new(CatalogItemId, Quantity, UnitPrice, DiscountAmount, TaxRate);
}

public sealed record CreateEcommerceOrderRequest(
    Guid WarehouseId,
    EcommercePaymentMethod PaymentMethod,
    EcommerceShippingMethod ShippingMethod,
    EcommerceCustomerInfo Customer,
    EcommerceShippingInfo Shipping,
    IReadOnlyList<CreateEcommerceOrderItemRequest> Items,
    decimal ShippingCost = 0m,
    string? InternalNotes = null,
    string? CustomerNotes = null);

public sealed record ConfirmEcommercePaymentRequest(string? PaymentReference = null);

public sealed record ShipEcommerceOrderRequest(string Carrier, string? TrackingNumber = null);

public sealed record CancelEcommerceOrderRequest(string Reason);

public sealed record LinkEcommerceInvoiceRequest(Guid BillingInvoiceId);
