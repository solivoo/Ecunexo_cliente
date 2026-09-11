using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Orden de compra de comercio electrónico (Agregado Raíz).
/// Coordina la reserva de stock, el flujo de despacho y el enlace con facturación electrónica SRI.
/// </summary>
public sealed class EcommerceOrder : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int OrderNumberMaxLength = 50;
    public const int PaymentReferenceMaxLength = 100;
    public const int NotesMaxLength = 1000;

    private readonly List<EcommerceOrderItem> _items = [];
    private readonly List<EcommerceOrderTimeline> _timeline = [];

    private EcommerceOrder()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string OrderNumber { get; private set; } = string.Empty;

    public Guid WarehouseId { get; private set; }

    public Warehouse? Warehouse { get; private set; }

    public DateTimeOffset OrderDate { get; private set; }

    public EcommerceOrderStatus Status { get; private set; } = EcommerceOrderStatus.Placed;

    public EcommercePaymentStatus PaymentStatus { get; private set; } = EcommercePaymentStatus.Pending;

    public EcommercePaymentMethod PaymentMethod { get; private set; } = EcommercePaymentMethod.CreditCard;

    public string? PaymentReference { get; private set; }

    public EcommerceShippingMethod ShippingMethod { get; private set; } = EcommerceShippingMethod.Courier;

    public EcommerceCustomerInfo Customer { get; private set; } = null!;

    public EcommerceShippingInfo Shipping { get; private set; } = null!;

    public decimal Subtotal { get; private set; }

    public decimal DiscountAmount { get; private set; }

    public decimal TaxAmount { get; private set; }

    public decimal ShippingCost { get; private set; }

    public decimal TotalAmount { get; private set; }

    public Guid? BillingInvoiceId { get; private set; }

    public DateTimeOffset? EstimatedDeliveryDate { get; private set; }

    public DateTimeOffset? ShippedAt { get; private set; }

    public DateTimeOffset? DeliveredAt { get; private set; }

    public DateTimeOffset? CancelledAt { get; private set; }

    public string? CancellationReason { get; private set; }

    public string? InternalNotes { get; private set; }

    public string? CustomerNotes { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyList<EcommerceOrderItem> Items => _items.AsReadOnly();

    public IReadOnlyList<EcommerceOrderTimeline> Timeline => _timeline.AsReadOnly();

    public static Result<EcommerceOrder> Create(
        Guid id,
        Guid tenantId,
        string orderNumber,
        Guid warehouseId,
        EcommercePaymentMethod paymentMethod,
        EcommerceShippingMethod shippingMethod,
        EcommerceCustomerInfo customer,
        EcommerceShippingInfo shipping,
        decimal shippingCost = 0m,
        string? internalNotes = null,
        string? customerNotes = null,
        Guid? createdBy = null,
        string? createdByName = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.id_empty", "El id de la orden no puede ser vacío.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.tenant_empty", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (warehouseId == Guid.Empty)
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.warehouse_required", "La bodega de origen para reserva de stock es obligatoria.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(orderNumber))
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.number_empty", "El número de orden es obligatorio.", ErrorType.Validation));
        }

        if (customer is null)
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.customer_required", "La información del cliente es obligatoria.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(customer.CustomerName) || string.IsNullOrWhiteSpace(customer.TaxId))
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.customer_invalid", "El nombre/razón social y la identificación tributaria del cliente son obligatorios.", ErrorType.Validation));
        }

        if (shipping is null)
        {
            return Result.Failure<EcommerceOrder>(
                new Error("ecommerce.order.shipping_required", "La información de envío es obligatoria.", ErrorType.Validation));
        }

        var order = new EcommerceOrder
        {
            Id = id,
            TenantId = tenantId,
            OrderNumber = orderNumber.Trim(),
            WarehouseId = warehouseId,
            OrderDate = DateTimeOffset.UtcNow,
            Status = EcommerceOrderStatus.Placed,
            PaymentStatus = EcommercePaymentStatus.Pending,
            PaymentMethod = paymentMethod,
            ShippingMethod = shippingMethod,
            Customer = customer,
            Shipping = shipping,
            ShippingCost = Math.Max(0m, shippingCost),
            InternalNotes = string.IsNullOrWhiteSpace(internalNotes) ? null : internalNotes.Trim(),
            CustomerNotes = string.IsNullOrWhiteSpace(customerNotes) ? null : customerNotes.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };

        var initialTimeline = EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            order.Id,
            previousStatus: null,
            newStatus: EcommerceOrderStatus.Placed,
            notes: "Orden recibida en plataforma ecommerce. Stock reservado en bodega.",
            userId: createdBy,
            userName: createdByName ?? "Sistema");

        order._timeline.Add(initialTimeline);

        return order;
    }

    public Result AddItem(EcommerceOrderItem item)
    {
        if (item is null)
        {
            return Result.Failure(
                new Error("ecommerce.order.item_null", "El ítem a agregar no puede ser nulo.", ErrorType.Validation));
        }

        if (Status != EcommerceOrderStatus.Placed)
        {
            return Result.Failure(
                new Error("ecommerce.order.cannot_modify_items", "Solo se pueden agregar ítems en órdenes con estado Placed.", ErrorType.Validation));
        }

        _items.Add(item);
        RecalculateTotals();
        return Result.Success();
    }

    public void RecalculateTotals()
    {
        Subtotal = decimal.Round(_items.Sum(i => Math.Max(0m, (i.Quantity * i.UnitPrice) - i.DiscountAmount)), 2, MidpointRounding.AwayFromZero);
        DiscountAmount = decimal.Round(_items.Sum(i => i.DiscountAmount), 2, MidpointRounding.AwayFromZero);
        TaxAmount = decimal.Round(_items.Sum(i => i.TaxAmount), 2, MidpointRounding.AwayFromZero);
        TotalAmount = decimal.Round(Subtotal + TaxAmount + ShippingCost, 2, MidpointRounding.AwayFromZero);
    }

    public Result ConfirmPayment(
        string? paymentReference,
        Guid? userId,
        string? userName)
    {
        if (Status == EcommerceOrderStatus.Cancelled || Status == EcommerceOrderStatus.Refunded)
        {
            return Result.Failure(
                new Error("ecommerce.order.invalid_state", "No se puede confirmar pago en una orden cancelada o reembolsada.", ErrorType.Validation));
        }

        var prevStatus = Status;
        PaymentStatus = EcommercePaymentStatus.Paid;
        PaymentReference = string.IsNullOrWhiteSpace(paymentReference) ? PaymentReference : paymentReference.Trim();

        if (Status == EcommerceOrderStatus.Placed)
        {
            Status = EcommerceOrderStatus.Confirmed;
        }

        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            prevStatus,
            Status,
            $"Pago acreditado ({PaymentMethod}). Referencia: {PaymentReference ?? "N/A"}",
            userId,
            userName));

        return Result.Success();
    }

    public Result MarkProcessing(Guid? userId, string? userName)
    {
        if (Status != EcommerceOrderStatus.Confirmed && Status != EcommerceOrderStatus.Placed)
        {
            return Result.Failure(
                new Error("ecommerce.order.cannot_process", "Solo se pueden preparar órdenes en estado Placed o Confirmed.", ErrorType.Validation));
        }

        var prevStatus = Status;
        Status = EcommerceOrderStatus.Processing;
        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            prevStatus,
            Status,
            "Orden en preparación de paquetes y rotulado para despacho.",
            userId,
            userName));

        return Result.Success();
    }

    public Result MarkShipped(
        string carrier,
        string trackingNumber,
        Guid? userId,
        string? userName)
    {
        if (Status != EcommerceOrderStatus.Processing && Status != EcommerceOrderStatus.Confirmed)
        {
            return Result.Failure(
                new Error("ecommerce.order.cannot_ship", "Solo se pueden despachar órdenes en preparación o confirmadas.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(carrier))
        {
            return Result.Failure(
                new Error("ecommerce.order.carrier_required", "El transportista o courier es obligatorio para el despacho.", ErrorType.Validation));
        }

        var prevStatus = Status;
        Status = EcommerceOrderStatus.Shipped;
        ShippedAt = DateTimeOffset.UtcNow;

        Shipping = Shipping with
        {
            Carrier = carrier.Trim(),
            TrackingNumber = string.IsNullOrWhiteSpace(trackingNumber) ? null : trackingNumber.Trim(),
        };

        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            prevStatus,
            Status,
            $"Orden despachada vía {carrier.Trim()}. Guía/Tracking: {trackingNumber?.Trim() ?? "Sin tracking"}",
            userId,
            userName));

        return Result.Success();
    }

    public Result MarkDelivered(Guid? userId, string? userName)
    {
        if (Status != EcommerceOrderStatus.Shipped)
        {
            return Result.Failure(
                new Error("ecommerce.order.cannot_deliver", "Solo se pueden marcar como entregadas las órdenes previamente despachadas.", ErrorType.Validation));
        }

        var prevStatus = Status;
        Status = EcommerceOrderStatus.Delivered;
        DeliveredAt = DateTimeOffset.UtcNow;
        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            prevStatus,
            Status,
            "Orden entregada satisfactoriamente al destinatario.",
            userId,
            userName));

        return Result.Success();
    }

    public Result Cancel(
        string reason,
        Guid? userId,
        string? userName)
    {
        if (Status == EcommerceOrderStatus.Shipped || Status == EcommerceOrderStatus.Delivered)
        {
            return Result.Failure(
                new Error("ecommerce.order.cannot_cancel_shipped", "No se puede anular una orden que ya ha sido despachada o entregada. Requiere proceso de devolución/reembolso.", ErrorType.Conflict));
        }

        if (Status == EcommerceOrderStatus.Cancelled)
        {
            return Result.Failure(
                new Error("ecommerce.order.already_cancelled", "La orden ya se encuentra anulada.", ErrorType.Conflict));
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure(
                new Error("ecommerce.order.cancel_reason_required", "El motivo de anulación es obligatorio.", ErrorType.Validation));
        }

        var prevStatus = Status;
        Status = EcommerceOrderStatus.Cancelled;
        CancelledAt = DateTimeOffset.UtcNow;
        CancellationReason = reason.Trim();
        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            prevStatus,
            Status,
            $"Orden cancelada. Motivo: {reason.Trim()}. Reserva de stock liberada.",
            userId,
            userName));

        return Result.Success();
    }

    public Result LinkBillingInvoice(Guid invoiceId, Guid? userId)
    {
        if (invoiceId == Guid.Empty)
        {
            return Result.Failure(
                new Error("ecommerce.order.invoice_empty", "El id de factura es obligatorio.", ErrorType.Validation));
        }

        if (BillingInvoiceId.HasValue && BillingInvoiceId.Value != invoiceId)
        {
            return Result.Failure(
                new Error("ecommerce.order.already_invoiced", "Esta orden ya tiene una factura electrónica SRI vinculada.", ErrorType.Conflict));
        }

        BillingInvoiceId = invoiceId;
        Touch(userId);

        _timeline.Add(EcommerceOrderTimeline.Create(
            Guid.NewGuid(),
            Id,
            Status,
            Status,
            $"Factura electrónica SRI vinculada con éxito. ID: {invoiceId:N}",
            userId,
            userName: "Facturación SRI"));

        return Result.Success();
    }

    public void UpdateShippingDetails(EcommerceShippingInfo shipping, Guid? userId)
    {
        Shipping = shipping;
        Touch(userId);
    }

    public void UpdateNotes(string? internalNotes, string? customerNotes, Guid? userId)
    {
        InternalNotes = string.IsNullOrWhiteSpace(internalNotes) ? null : internalNotes.Trim();
        CustomerNotes = string.IsNullOrWhiteSpace(customerNotes) ? null : customerNotes.Trim();
        Touch(userId);
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
