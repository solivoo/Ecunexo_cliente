using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.Ecommerce;

public enum StockReservationStatus
{
    Active = 1,
    PartiallyPaid = 2,
    Paid = 3,
    Invoiced = 4,
    Cancelled = 5,
}

/// <summary>
/// Reserva de stock para cliente con soporte de múltiples abonos con comprobante y facturación controlada.
/// </summary>
public sealed class StockReservation : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int ReservationNumberMaxLength = 40;
    public const int CustomerNameMaxLength = 200;
    public const int CustomerTaxIdMaxLength = 30;
    public const int ObservationMaxLength = 1000;
    public const int NotesMaxLength = 1000;
    public const int ReferenceMaxLength = 120;
    public const int ProofObjectKeyMaxLength = 500;
    public const int ProofContentTypeMaxLength = 100;

    private readonly List<StockReservationItem> _items = [];
    private readonly List<StockReservationPayment> _payments = [];

    private StockReservation() { }

    public Guid TenantId { get; private set; }
    public Tenant? Tenant { get; private set; }
    public string ReservationNumber { get; private set; } = string.Empty;
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public Guid CustomerId { get; private set; }
    public Customer? Customer { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string CustomerTaxId { get; private set; } = string.Empty;
    public string? CustomerEmail { get; private set; }
    public string? CustomerPhone { get; private set; }
    public StockReservationStatus Status { get; private set; } = StockReservationStatus.Active;
    public DateTimeOffset ReservedAtUtc { get; private set; }
    public DateTimeOffset? ExpiresAtUtc { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal TotalAmount { get; private set; }
    public decimal PaidAmount { get; private set; }
    public decimal BalanceAmount => Math.Max(0m, decimal.Round(TotalAmount - PaidAmount, 2, MidpointRounding.AwayFromZero));
    public bool IsFullyPaid => PaidAmount >= TotalAmount && TotalAmount > 0m;
    public Guid? BillingInvoiceId { get; private set; }
    public string? InvoiceObservation { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset? InvoicedAtUtc { get; private set; }
    public DateTimeOffset? CancelledAtUtc { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyCollection<StockReservationItem> Items => _items.AsReadOnly();
    public IReadOnlyCollection<StockReservationPayment> Payments => _payments.AsReadOnly();

    public static Result<StockReservation> Create(
        Guid id,
        Guid tenantId,
        string reservationNumber,
        Guid warehouseId,
        Guid customerId,
        string customerName,
        string customerTaxId,
        string? customerEmail = null,
        string? customerPhone = null,
        DateTimeOffset? expiresAtUtc = null,
        string? notes = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<StockReservation>(
                new Error("ecommerce.reservation.id_empty", "El identificador de la reserva es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<StockReservation>(
                new Error("ecommerce.reservation.tenant_empty", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (warehouseId == Guid.Empty)
        {
            return Result.Failure<StockReservation>(
                new Error("ecommerce.reservation.warehouse_empty", "La bodega de reserva es obligatoria.", ErrorType.Validation));
        }

        if (customerId == Guid.Empty || string.IsNullOrWhiteSpace(customerName))
        {
            return Result.Failure<StockReservation>(
                new Error("ecommerce.reservation.customer_required", "El cliente es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(reservationNumber))
        {
            return Result.Failure<StockReservation>(
                new Error("ecommerce.reservation.number_empty", "El número de reserva es obligatorio.", ErrorType.Validation));
        }

        var utcNow = DateTimeOffset.UtcNow;
        return Result.Success(new StockReservation
        {
            Id = id,
            TenantId = tenantId,
            ReservationNumber = reservationNumber.Trim(),
            WarehouseId = warehouseId,
            CustomerId = customerId,
            CustomerName = customerName.Trim(),
            CustomerTaxId = string.IsNullOrWhiteSpace(customerTaxId) ? "9999999999999" : customerTaxId.Trim(),
            CustomerEmail = string.IsNullOrWhiteSpace(customerEmail) ? null : customerEmail.Trim(),
            CustomerPhone = string.IsNullOrWhiteSpace(customerPhone) ? null : customerPhone.Trim(),
            Status = StockReservationStatus.Active,
            ReservedAtUtc = utcNow,
            ExpiresAtUtc = expiresAtUtc,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = utcNow,
            CreatedBy = createdBy,
        });
    }

    public Result AddItem(StockReservationItem item)
    {
        if (item is null)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.item_null", "El ítem no puede ser nulo.", ErrorType.Validation));
        }

        if (Status is StockReservationStatus.Invoiced or StockReservationStatus.Cancelled)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.closed", "No se pueden agregar ítems a una reserva facturada o anulada.", ErrorType.Conflict));
        }

        _items.Add(item);
        RecalculateTotals();
        return Result.Success();
    }

    public Result AddPayment(
        Guid paymentId,
        decimal amount,
        EcommercePaymentMethod paymentMethod,
        string? reference,
        string? notes,
        string? proofObjectKey,
        string? proofContentType,
        Guid? recordedBy)
    {
        if (Status is StockReservationStatus.Invoiced or StockReservationStatus.Cancelled)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.closed", "No se pueden registrar aportes en una reserva facturada o anulada.", ErrorType.Conflict));
        }

        var paymentResult = StockReservationPayment.Create(
            paymentId,
            Id,
            amount,
            paymentMethod,
            reference,
            notes,
            proofObjectKey,
            proofContentType,
            recordedBy);
        if (paymentResult.IsFailure)
        {
            return Result.Failure(paymentResult.Error!);
        }

        _payments.Add(paymentResult.Value!);
        PaidAmount = decimal.Round(_payments.Sum(p => p.Amount), 2, MidpointRounding.AwayFromZero);
        Status = PaidAmount >= TotalAmount && TotalAmount > 0m
            ? StockReservationStatus.Paid
            : PaidAmount > 0m
                ? StockReservationStatus.PartiallyPaid
                : StockReservationStatus.Active;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = recordedBy;

        return Result.Success();
    }

    public Result MarkInvoiced(Guid billingInvoiceId, string? observation, Guid? userId)
    {
        if (billingInvoiceId == Guid.Empty)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.invoice_invalid", "El identificador de factura es obligatorio.", ErrorType.Validation));
        }

        if (Status == StockReservationStatus.Cancelled)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.cancelled", "No se puede facturar una reserva anulada.", ErrorType.Conflict));
        }

        if (Status == StockReservationStatus.Invoiced)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.already_invoiced", "La reserva ya fue facturada.", ErrorType.Conflict));
        }

        var normalizedObservation = string.IsNullOrWhiteSpace(observation) ? null : observation.Trim();
        if (!IsFullyPaid && normalizedObservation is null)
        {
            return Result.Failure(
                new Error(
                    "ecommerce.reservation.partial_payment_observation_required",
                    $"La reserva tiene un saldo pendiente de ${BalanceAmount:0.00}. Debe ingresar una observación para facturar.",
                    ErrorType.Validation));
        }

        if (normalizedObservation is { Length: > ObservationMaxLength })
        {
            return Result.Failure(
                new Error(
                    "ecommerce.reservation.observation_length",
                    $"La observación no puede superar {ObservationMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        BillingInvoiceId = billingInvoiceId;
        InvoiceObservation = normalizedObservation;
        Status = StockReservationStatus.Invoiced;
        InvoicedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAt = InvoicedAtUtc;
        UpdatedBy = userId;

        return Result.Success();
    }

    public Result Cancel(string? reason, Guid? userId)
    {
        if (Status == StockReservationStatus.Invoiced)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.already_invoiced", "No se puede anular una reserva ya facturada.", ErrorType.Conflict));
        }

        if (Status == StockReservationStatus.Cancelled)
        {
            return Result.Failure(
                new Error("ecommerce.reservation.already_cancelled", "La reserva ya está anulada.", ErrorType.Conflict));
        }

        Status = StockReservationStatus.Cancelled;
        CancelledAtUtc = DateTimeOffset.UtcNow;
        CancellationReason = string.IsNullOrWhiteSpace(reason) ? "Anulada manualmente" : reason.Trim();
        UpdatedAt = CancelledAtUtc;
        UpdatedBy = userId;

        return Result.Success();
    }

    private void RecalculateTotals()
    {
        Subtotal = decimal.Round(_items.Sum(i => i.LineSubtotal), 2, MidpointRounding.AwayFromZero);
        TaxAmount = decimal.Round(_items.Sum(i => i.LineTax), 2, MidpointRounding.AwayFromZero);
        TotalAmount = decimal.Round(Subtotal + TaxAmount, 2, MidpointRounding.AwayFromZero);
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}

public sealed class StockReservationItem : Entity<Guid>
{
    private StockReservationItem() { }

    public Guid StockReservationId { get; private set; }
    public Guid CatalogItemId { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public string ItemName { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TaxRate { get; private set; }
    public decimal LineSubtotal { get; private set; }
    public decimal LineTax { get; private set; }
    public decimal LineTotal { get; private set; }

    public static Result<StockReservationItem> Create(
        Guid id,
        Guid stockReservationId,
        Guid catalogItemId,
        string sku,
        string itemName,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate = 0.15m)
    {
        if (id == Guid.Empty || stockReservationId == Guid.Empty || catalogItemId == Guid.Empty)
        {
            return Result.Failure<StockReservationItem>(
                new Error("ecommerce.reservation.item_invalid", "Identificadores de ítem inválidos.", ErrorType.Validation));
        }

        if (quantity <= 0m)
        {
            return Result.Failure<StockReservationItem>(
                new Error("ecommerce.reservation.qty_invalid", "La cantidad debe ser mayor a 0.", ErrorType.Validation));
        }

        if (unitPrice < 0m)
        {
            return Result.Failure<StockReservationItem>(
                new Error("ecommerce.reservation.price_invalid", "El precio unitario no puede ser negativo.", ErrorType.Validation));
        }

        var normalizedTax = taxRate > 1m ? taxRate / 100m : taxRate;
        var lineSubtotal = decimal.Round(quantity * unitPrice, 2, MidpointRounding.AwayFromZero);
        var lineTax = decimal.Round(lineSubtotal * normalizedTax, 2, MidpointRounding.AwayFromZero);

        return Result.Success(new StockReservationItem
        {
            Id = id,
            StockReservationId = stockReservationId,
            CatalogItemId = catalogItemId,
            Sku = sku.Trim(),
            ItemName = itemName.Trim(),
            Quantity = decimal.Round(quantity, 4, MidpointRounding.AwayFromZero),
            UnitPrice = decimal.Round(unitPrice, 4, MidpointRounding.AwayFromZero),
            TaxRate = normalizedTax,
            LineSubtotal = lineSubtotal,
            LineTax = lineTax,
            LineTotal = decimal.Round(lineSubtotal + lineTax, 2, MidpointRounding.AwayFromZero),
        });
    }
}

public sealed class StockReservationPayment : Entity<Guid>
{
    private StockReservationPayment() { }

    public Guid StockReservationId { get; private set; }
    public decimal Amount { get; private set; }
    public EcommercePaymentMethod PaymentMethod { get; private set; }
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
    public string? ProofObjectKey { get; private set; }
    public string? ProofContentType { get; private set; }
    public DateTimeOffset PaidAtUtc { get; private set; }
    public Guid? RecordedBy { get; private set; }

    public static Result<StockReservationPayment> Create(
        Guid id,
        Guid stockReservationId,
        decimal amount,
        EcommercePaymentMethod paymentMethod,
        string? reference,
        string? notes,
        string? proofObjectKey,
        string? proofContentType,
        Guid? recordedBy)
    {
        if (amount <= 0m)
        {
            return Result.Failure<StockReservationPayment>(
                new Error("ecommerce.reservation.payment_amount", "El aporte de pago debe ser mayor a 0.", ErrorType.Validation));
        }

        return Result.Success(new StockReservationPayment
        {
            Id = id,
            StockReservationId = stockReservationId,
            Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero),
            PaymentMethod = paymentMethod,
            Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            ProofObjectKey = string.IsNullOrWhiteSpace(proofObjectKey) ? null : proofObjectKey.Trim(),
            ProofContentType = string.IsNullOrWhiteSpace(proofContentType) ? null : proofContentType.Trim(),
            PaidAtUtc = DateTimeOffset.UtcNow,
            RecordedBy = recordedBy,
        });
    }
}
