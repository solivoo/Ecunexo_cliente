using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Purchases;

/// <summary>
/// Estado del ciclo de vida de una proforma o cotización de compra.
/// </summary>
public enum PurchaseProformaStatus
{
    Draft = 1,
    Approved = 2,
    ConvertedToPurchase = 3,
    Rejected = 4,
    Expired = 5
}

/// <summary>
/// Cotización o proforma recibida de un proveedor antes de la compra definitiva.
/// </summary>
public sealed class PurchaseProforma : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NumberMaxLength = 50;
    public const int CurrencyMaxLength = 3;
    public const int NotesMaxLength = 1000;
    public const int AttachmentUrlMaxLength = 1000;

    private readonly List<PurchaseProformaItem> _items = [];

    private PurchaseProforma()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid SupplierId { get; private set; }
    public Supplier? Supplier { get; private set; }

    /// <summary>Número o código de proforma emitido por el proveedor.</summary>
    public string ProformaNumber { get; private set; } = string.Empty;

    /// <summary>Fecha de emisión de la cotización.</summary>
    public DateOnly IssueDate { get; private set; }

    /// <summary>Fecha límite de vigencia de los precios cotizados.</summary>
    public DateOnly? ExpirationDate { get; private set; }

    public PurchaseProformaStatus Status { get; private set; } = PurchaseProformaStatus.Draft;

    /// <summary>Moneda (por defecto USD en Ecuador).</summary>
    public string Currency { get; private set; } = "USD";

    /// <summary>Subtotal neto sin impuestos.</summary>
    public decimal Subtotal { get; private set; }

    /// <summary>Monto total de IVA cotizado.</summary>
    public decimal TaxAmount { get; private set; }

    /// <summary>Total general de la proforma.</summary>
    public decimal TotalAmount { get; private set; }

    /// <summary>URL del PDF/imagen de la proforma almacenada en Object Storage (B2/S3).</summary>
    public string? AttachmentUrl { get; private set; }

    /// <summary>Nombre original del archivo adjunto.</summary>
    public string? AttachmentFileName { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>Id de la factura o documento de compra al que fue convertida (si aplica).</summary>
    public Guid? ConvertedPurchaseId { get; private set; }

    public IReadOnlyCollection<PurchaseProformaItem> Items => _items.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public static Result<PurchaseProforma> Create(
        Guid id,
        Guid tenantId,
        Guid supplierId,
        string proformaNumber,
        DateOnly issueDate,
        DateOnly? expirationDate = null,
        string currency = "USD",
        string? notes = null,
        string? attachmentUrl = null,
        string? attachmentFileName = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.id.empty", "El Id de la proforma es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (supplierId == Guid.Empty)
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.supplier.empty", "El proveedor es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(proformaNumber))
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.number.empty", "El número de proforma es obligatorio.", ErrorType.Validation));
        }

        var trimmedNumber = proformaNumber.Trim();
        if (trimmedNumber.Length > NumberMaxLength)
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.number.toolong", $"El número de proforma no puede superar los {NumberMaxLength} caracteres.", ErrorType.Validation));
        }

        if (expirationDate.HasValue && expirationDate.Value < issueDate)
        {
            return Result.Failure<PurchaseProforma>(new Error("proforma.dates.invalid", "La fecha de caducidad no puede ser anterior a la fecha de emisión.", ErrorType.Validation));
        }

        return new PurchaseProforma
        {
            Id = id,
            TenantId = tenantId,
            SupplierId = supplierId,
            ProformaNumber = trimmedNumber,
            IssueDate = issueDate,
            ExpirationDate = expirationDate,
            Status = PurchaseProformaStatus.Draft,
            Currency = string.IsNullOrWhiteSpace(currency) ? "USD" : currency.Trim().ToUpperInvariant(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            AttachmentUrl = string.IsNullOrWhiteSpace(attachmentUrl) ? null : attachmentUrl.Trim(),
            AttachmentFileName = string.IsNullOrWhiteSpace(attachmentFileName) ? null : attachmentFileName.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        };
    }

    public Result AddItem(
        Guid id,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate = 15.00m,
        Guid? catalogItemId = null,
        Guid? expenseTypeId = null)
    {
        if (Status != PurchaseProformaStatus.Draft)
        {
            return Result.Failure(new Error("proforma.status.readonly", "Solo se pueden modificar líneas en proformas en estado Borrador.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Failure(new Error("proforma.item.description.empty", "La descripción del ítem es obligatoria.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure(new Error("proforma.item.quantity.invalid", "La cantidad debe ser mayor a cero.", ErrorType.Validation));
        }

        if (unitPrice < 0)
        {
            return Result.Failure(new Error("proforma.item.price.invalid", "El precio unitario no puede ser negativo.", ErrorType.Validation));
        }

        var item = new PurchaseProformaItem(
            id: id,
            proformaId: Id,
            description: description.Trim(),
            quantity: quantity,
            unitPrice: unitPrice,
            taxRate: taxRate,
            catalogItemId: catalogItemId,
            expenseTypeId: expenseTypeId);

        _items.Add(item);
        RecalculateTotals();
        return Result.Success();
    }

    public Result Approve(Guid? updatedBy = null)
    {
        if (Status != PurchaseProformaStatus.Draft)
        {
            return Result.Failure(new Error("proforma.approve.invalid_status", "Solo se pueden aprobar proformas en borrador.", ErrorType.Validation));
        }

        if (_items.Count == 0)
        {
            return Result.Failure(new Error("proforma.approve.no_items", "No se puede aprobar una proforma sin ítems cotizados.", ErrorType.Validation));
        }

        Status = PurchaseProformaStatus.Approved;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result MarkConvertedToPurchase(Guid purchaseId, Guid? updatedBy = null)
    {
        if (Status != PurchaseProformaStatus.Approved && Status != PurchaseProformaStatus.Draft)
        {
            return Result.Failure(new Error("proforma.convert.invalid_status", "Solo proformas en borrador o aprobadas pueden convertirse en compra.", ErrorType.Validation));
        }

        if (purchaseId == Guid.Empty)
        {
            return Result.Failure(new Error("proforma.convert.purchase_empty", "El Id del documento de compra es obligatorio.", ErrorType.Validation));
        }

        Status = PurchaseProformaStatus.ConvertedToPurchase;
        ConvertedPurchaseId = purchaseId;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result Reject(string? reason = null, Guid? updatedBy = null)
    {
        if (Status == PurchaseProformaStatus.ConvertedToPurchase)
        {
            return Result.Failure(new Error("proforma.reject.already_converted", "No se puede rechazar una proforma ya convertida en compra.", ErrorType.Validation));
        }

        Status = PurchaseProformaStatus.Rejected;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? $"Rechazo: {reason.Trim()}" : $"{Notes} | Rechazo: {reason.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result SetAttachment(string attachmentUrl, string fileName, Guid? updatedBy = null)
    {
        AttachmentUrl = attachmentUrl.Trim();
        AttachmentFileName = fileName.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    private void RecalculateTotals()
    {
        decimal subtotal = 0;
        decimal tax = 0;

        foreach (var item in _items)
        {
            var lineSubtotal = Math.Round(item.Quantity * item.UnitPrice, 2, MidpointRounding.AwayFromZero);
            var lineTax = Math.Round(lineSubtotal * (item.TaxRate / 100.0m), 2, MidpointRounding.AwayFromZero);
            subtotal += lineSubtotal;
            tax += lineTax;
        }

        Subtotal = subtotal;
        TaxAmount = tax;
        TotalAmount = subtotal + tax;
    }
}

/// <summary>
/// Línea cotizada dentro de una proforma de compra.
/// </summary>
public sealed class PurchaseProformaItem : Entity<Guid>
{
    public const int DescriptionMaxLength = 300;

    internal PurchaseProformaItem(
        Guid id,
        Guid proformaId,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate,
        Guid? catalogItemId,
        Guid? expenseTypeId)
    {
        Id = id;
        PurchaseProformaId = proformaId;
        Description = description;
        Quantity = quantity;
        UnitPrice = unitPrice;
        TaxRate = taxRate;
        CatalogItemId = catalogItemId;
        ExpenseTypeId = expenseTypeId;
        LineTotal = Math.Round(quantity * unitPrice * (1 + (taxRate / 100.0m)), 2, MidpointRounding.AwayFromZero);
    }

    private PurchaseProformaItem()
    {
    }

    public Guid PurchaseProformaId { get; private set; }
    public PurchaseProforma? PurchaseProforma { get; private set; }

    public Guid? CatalogItemId { get; private set; }
    public Guid? ExpenseTypeId { get; private set; }

    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TaxRate { get; private set; }
    public decimal LineTotal { get; private set; }
}
