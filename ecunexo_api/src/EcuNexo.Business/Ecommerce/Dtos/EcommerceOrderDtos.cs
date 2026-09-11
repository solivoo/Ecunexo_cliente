using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Dtos;

public sealed record EcommerceCustomerDto(
    string CustomerName,
    string TaxId,
    string? TaxIdType,
    string Email,
    string? Phone,
    string? Address);

public sealed record EcommerceShippingDto(
    string RecipientName,
    string? RecipientPhone,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? Province,
    string? PostalCode,
    string? Carrier,
    string? TrackingNumber,
    string? Notes);

public sealed record EcommerceOrderItemDto(
    Guid Id,
    Guid CatalogItemId,
    string Sku,
    string ItemName,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalAmount);

public sealed record EcommerceOrderTimelineDto(
    Guid Id,
    EcommerceOrderStatus? PreviousStatus,
    EcommerceOrderStatus NewStatus,
    string? Notes,
    DateTimeOffset OccurredAt,
    Guid? UserId,
    string? UserName);

public sealed record EcommerceOrderSummaryDto(
    Guid Id,
    string OrderNumber,
    Guid WarehouseId,
    string? WarehouseName,
    DateTimeOffset OrderDate,
    EcommerceOrderStatus Status,
    EcommercePaymentStatus PaymentStatus,
    EcommercePaymentMethod PaymentMethod,
    string? PaymentReference,
    EcommerceShippingMethod ShippingMethod,
    string CustomerName,
    string CustomerTaxId,
    string CustomerEmail,
    string RecipientCity,
    decimal TotalAmount,
    int ItemsCount,
    Guid? BillingInvoiceId,
    DateTimeOffset CreatedAt);

public sealed record EcommerceOrderDetailDto(
    Guid Id,
    Guid TenantId,
    string OrderNumber,
    Guid WarehouseId,
    string? WarehouseName,
    DateTimeOffset OrderDate,
    EcommerceOrderStatus Status,
    EcommercePaymentStatus PaymentStatus,
    EcommercePaymentMethod PaymentMethod,
    string? PaymentReference,
    EcommerceShippingMethod ShippingMethod,
    EcommerceCustomerDto Customer,
    EcommerceShippingDto Shipping,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal ShippingCost,
    decimal TotalAmount,
    Guid? BillingInvoiceId,
    DateTimeOffset? EstimatedDeliveryDate,
    DateTimeOffset? ShippedAt,
    DateTimeOffset? DeliveredAt,
    DateTimeOffset? CancelledAt,
    string? CancellationReason,
    string? InternalNotes,
    string? CustomerNotes,
    DateTimeOffset CreatedAt,
    IReadOnlyList<EcommerceOrderItemDto> Items,
    IReadOnlyList<EcommerceOrderTimelineDto> Timeline);
