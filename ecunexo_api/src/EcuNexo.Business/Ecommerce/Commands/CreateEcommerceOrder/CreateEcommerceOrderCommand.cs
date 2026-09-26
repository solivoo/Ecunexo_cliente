using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;

public sealed record CreateEcommerceOrderItemInput(
    Guid CatalogItemId,
    decimal Quantity);

public sealed record CreateEcommerceOrderCommand(
    Guid TenantId,
    Guid WarehouseId,
    EcommercePaymentMethod PaymentMethod,
    EcommerceShippingMethod ShippingMethod,
    EcommerceCustomerInfo Customer,
    EcommerceShippingInfo Shipping,
    IReadOnlyList<CreateEcommerceOrderItemInput> Items,
    decimal ShippingCost = 0m,
    string? InternalNotes = null,
    string? CustomerNotes = null,
    Guid? CreatedBy = null,
    string? CreatedByName = null) : ICommand<CreateEcommerceOrderResponse>;

public sealed record CreateEcommerceOrderResponse(
    Guid OrderId,
    string OrderNumber,
    EcommerceOrderStatus Status,
    decimal TotalAmount);
