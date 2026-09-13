using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Purchases;

/// <summary>
/// Estados del ciclo de vida de una compra de bienes o servicios.
/// </summary>
public enum PurchaseStatus
{
    Draft = 1,
    Received = 2,
    Invoiced = 3,
    Cancelled = 4
}

/// <summary>
/// Línea o ítem detallado de una factura o documento de compra.
/// </summary>
public sealed class PurchaseItem : Entity<Guid>
{
    public const int ItemCodeMaxLength = 50;
    public const int DescriptionMaxLength = 300;

    private PurchaseItem()
    {
    }

    public Guid PurchaseId { get; private set; }

    /// <summary>Vínculo opcional a un ítem existente en el catálogo del tenant.</summary>
    public Guid? CatalogItemId { get; private set; }

    /// <summary>Bodega de destino donde ingresará el stock físico si afecta inventario.</summary>
    public Guid? WarehouseId { get; private set; }

    /// <summary>Código asignado por el proveedor o código de barras.</summary>
    public string ItemCode { get; private set; } = string.Empty;

    /// <summary>Descripción comercial del bien o servicio adquirido.</summary>
    public string Description { get; private set; } = string.Empty;

    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Discount { get; private set; }

    /// <summary>Subtotal neto sin IVA (Quantity * UnitPrice - Discount).</summary>
    public decimal Subtotal { get; private set; }

    /// <summary>Tarifa porcentual de IVA aplicada (ej. 15, 5, 0).</summary>
    public decimal TaxRate { get; private set; }

    /// <summary>Monto de IVA liquidado para esta línea.</summary>
    public decimal TaxAmount { get; private set; }

    /// <summary>Total bruto de la línea (Subtotal + TaxAmount).</summary>
    public decimal Total { get; private set; }

    /// <summary>Indica si el ítem debe ingresar a bodega física y mover kárdex.</summary>
    public bool AffectsInventory { get; private set; }

    public static Result<PurchaseItem> Create(
        Guid id,
        Guid purchaseId,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal discount = 0m,
        decimal taxRate = 15m,
        string? itemCode = null,
        Guid? catalogItemId = null,
        Guid? warehouseId = null,
        bool affectsInventory = false)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.id.empty", "El Id del ítem es obligatorio.", ErrorType.Validation));
        }

        if (purchaseId == Guid.Empty)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.purchase_id.empty", "El Id de la compra es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.description.empty", "La descripción del ítem es obligatoria.", ErrorType.Validation));
        }

        if (description.Trim().Length > DescriptionMaxLength)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.description.too_long", $"La descripción no puede exceder {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.quantity.invalid", "La cantidad debe ser mayor a 0.", ErrorType.Validation));
        }

        if (unitPrice < 0)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.unit_price.negative", "El precio unitario no puede ser negativo.", ErrorType.Validation));
        }

        if (discount < 0)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.discount.negative", "El descuento no puede ser negativo.", ErrorType.Validation));
        }

        if (taxRate < 0 || taxRate > 100)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.tax_rate.invalid", "La tarifa de IVA debe estar entre 0% y 100%.", ErrorType.Validation));
        }

        var gross = quantity * unitPrice;
        if (discount > gross)
        {
            return Result.Failure<PurchaseItem>(new Error("purchase_item.discount.exceeds_gross", "El descuento no puede ser mayor al valor bruto de la línea.", ErrorType.Validation));
        }

        var subtotal = Math.Round(gross - discount, 2, MidpointRounding.AwayFromZero);
        var taxAmount = Math.Round(subtotal * (taxRate / 100m), 2, MidpointRounding.AwayFromZero);
        var total = subtotal + taxAmount;

        var item = new PurchaseItem
        {
            Id = id,
            PurchaseId = purchaseId,
            CatalogItemId = catalogItemId,
            WarehouseId = warehouseId,
            ItemCode = itemCode?.Trim().ToUpperInvariant() ?? string.Empty,
            Description = description.Trim(),
            Quantity = quantity,
            UnitPrice = unitPrice,
            Discount = discount,
            Subtotal = subtotal,
            TaxRate = taxRate,
            TaxAmount = taxAmount,
            Total = total,
            AffectsInventory = affectsInventory
        };

        return Result.Success(item);
    }

    public void LinkCatalogItem(Guid catalogItemId, Guid warehouseId, bool affectsInventory = true)
    {
        CatalogItemId = catalogItemId;
        WarehouseId = warehouseId;
        AffectsInventory = affectsInventory;
    }
}

/// <summary>
/// Factura, liquidación o documento de compra de bienes/servicios a proveedores (SRI Ecuador).
/// </summary>
public sealed class Purchase : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int InvoiceNumberMaxLength = 20;
    public const int AuthorizationNumberMaxLength = 49;
    public const int DocumentTypeMaxLength = 3;
    public const int SriSustentoCodeMaxLength = 2;
    public const int PaymentMethodMaxLength = 10;
    public const int NotesMaxLength = 1000;

    private readonly List<PurchaseItem> _items = [];

    private Purchase()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid SupplierId { get; private set; }
    public Supplier? Supplier { get; private set; }

    /// <summary>Tipo de gasto / concepto contable asignado a la compra.</summary>
    public Guid? ExpenseTypeId { get; private set; }
    public ExpenseType? ExpenseType { get; private set; }

    /// <summary>Proforma o cotización previa que originó esta compra (si aplica).</summary>
    public Guid? ProformaId { get; private set; }

    /// <summary>Tipo de comprobante según tabla 4 SRI ('01' = Factura, '03' = Liquidación de compra).</summary>
    public string DocumentType { get; private set; } = "01";

    /// <summary>Número de factura en formato establecimiento-puntoEmision-secuencial (ej: '001-002-000123456').</summary>
    public string InvoiceNumber { get; private set; } = string.Empty;

    /// <summary>Clave de acceso y autorización electrónica SRI de 49 dígitos numéricos.</summary>
    public string? AuthorizationNumber { get; private set; }

    /// <summary>Fecha de emisión del comprobante electrónico por parte del proveedor.</summary>
    public DateOnly IssueDate { get; private set; }

    /// <summary>Fecha y hora en que la compra fue ingresada o parseada al sistema.</summary>
    public DateTimeOffset RegistrationDate { get; private set; }

    /// <summary>Código de sustento de crédito tributario según tabla 5 ATS SRI (ej. '01', '02', '03').</summary>
    public string SriSustentoCode { get; private set; } = "01";

    /// <summary>Base imponible tarifa 0% IVA.</summary>
    public decimal SubtotalZero { get; private set; }

    /// <summary>Base imponible gravada con tarifa IVA (ej. 15%).</summary>
    public decimal SubtotalTaxed { get; private set; }

    /// <summary>Base imponible no objeto de IVA.</summary>
    public decimal SubtotalNoSubject { get; private set; }

    /// <summary>Base imponible exenta de IVA.</summary>
    public decimal SubtotalExempt { get; private set; }

    /// <summary>Tarifa de IVA predominante (ej. 15.00).</summary>
    public decimal TaxRate { get; private set; }

    /// <summary>Monto total de IVA liquidado.</summary>
    public decimal TaxAmount { get; private set; }

    /// <summary>Total de descuentos otorgados por el proveedor.</summary>
    public decimal TotalDiscount { get; private set; }

    /// <summary>Importe total general a pagar al proveedor.</summary>
    public decimal TotalAmount { get; private set; }

    /// <summary>Forma de pago según catálogo SRI ('01' Sin sistema financiero, '20' Otros con sistema financiero).</summary>
    public string? PaymentMethodCode { get; private set; }

    /// <summary>Días de crédito otorgados por el proveedor (0 = Contado).</summary>
    public int CreditDays { get; private set; }

    public PurchaseStatus Status { get; private set; } = PurchaseStatus.Draft;

    /// <summary>Documento de ingreso de inventario generado al recepcionar la mercadería.</summary>
    public Guid? InventoryDocumentId { get; private set; }

    /// <summary>Contenido original XML de la factura electrónica para auditoría y comprobante SRI.</summary>
    public string? RawXml { get; private set; }

    public string? Notes { get; private set; }

    public IReadOnlyCollection<PurchaseItem> Items => _items.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public static Result<Purchase> Create(
        Guid id,
        Guid tenantId,
        Guid supplierId,
        string invoiceNumber,
        DateOnly issueDate,
        string documentType = "01",
        string? authorizationNumber = null,
        Guid? expenseTypeId = null,
        string sriSustentoCode = "01",
        decimal subtotalZero = 0m,
        decimal subtotalTaxed = 0m,
        decimal subtotalNoSubject = 0m,
        decimal subtotalExempt = 0m,
        decimal taxRate = 15m,
        decimal taxAmount = 0m,
        decimal totalDiscount = 0m,
        decimal totalAmount = 0m,
        string? paymentMethodCode = null,
        int creditDays = 0,
        Guid? proformaId = null,
        string? rawXml = null,
        string? notes = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<Purchase>(new Error("purchase.id.empty", "El Id de la compra es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Purchase>(new Error("purchase.tenant_id.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (supplierId == Guid.Empty)
        {
            return Result.Failure<Purchase>(new Error("purchase.supplier_id.empty", "El Id del proveedor es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            return Result.Failure<Purchase>(new Error("purchase.invoice_number.empty", "El número de factura es obligatorio.", ErrorType.Validation));
        }

        var cleanInvoiceNumber = invoiceNumber.Trim();
        if (cleanInvoiceNumber.Length == 15 && cleanInvoiceNumber.All(char.IsDigit))
        {
            cleanInvoiceNumber = $"{cleanInvoiceNumber[..3]}-{cleanInvoiceNumber.Substring(3, 3)}-{cleanInvoiceNumber[6..]}";
        }

        if (!System.Text.RegularExpressions.Regex.IsMatch(cleanInvoiceNumber, @"^\d{3}-\d{3}-\d{9}$"))
        {
            return Result.Failure<Purchase>(new Error("purchase.invoice_number.invalid_format", "El número de factura debe tener el formato de 15 dígitos '001-002-000000001'.", ErrorType.Validation));
        }

        var maxAllowedDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        if (issueDate > maxAllowedDate)
        {
            return Result.Failure<Purchase>(new Error("purchase.issue_date.future", "La fecha de emisión no puede ser una fecha futura.", ErrorType.Validation));
        }

        if (subtotalZero < 0 || subtotalTaxed < 0 || subtotalNoSubject < 0 || subtotalExempt < 0 ||
            taxAmount < 0 || totalDiscount < 0 || totalAmount < 0)
        {
            return Result.Failure<Purchase>(new Error("purchase.amounts.negative", "Los montos de subtotales, impuestos o totales no pueden ser negativos.", ErrorType.Validation));
        }

        string? cleanAuth = null;
        if (!string.IsNullOrWhiteSpace(authorizationNumber))
        {
            cleanAuth = authorizationNumber.Trim();
            if (cleanAuth.Length != AuthorizationNumberMaxLength || !cleanAuth.All(char.IsDigit))
            {
                return Result.Failure<Purchase>(new Error("purchase.authorization_number.invalid", "La clave de acceso / autorización SRI debe tener exactamente 49 dígitos numéricos.", ErrorType.Validation));
            }
        }

        if (creditDays < 0)
        {
            return Result.Failure<Purchase>(new Error("purchase.credit_days.invalid", "Los días de crédito no pueden ser negativos.", ErrorType.Validation));
        }

        var now = DateTimeOffset.UtcNow;
        var purchase = new Purchase
        {
            Id = id,
            TenantId = tenantId,
            SupplierId = supplierId,
            InvoiceNumber = cleanInvoiceNumber,
            DocumentType = string.IsNullOrWhiteSpace(documentType) ? "01" : documentType.Trim(),
            AuthorizationNumber = cleanAuth,
            IssueDate = issueDate,
            RegistrationDate = now,
            ExpenseTypeId = expenseTypeId,
            SriSustentoCode = string.IsNullOrWhiteSpace(sriSustentoCode) ? "01" : sriSustentoCode.Trim(),
            SubtotalZero = Math.Max(0, subtotalZero),
            SubtotalTaxed = Math.Max(0, subtotalTaxed),
            SubtotalNoSubject = Math.Max(0, subtotalNoSubject),
            SubtotalExempt = Math.Max(0, subtotalExempt),
            TaxRate = taxRate,
            TaxAmount = Math.Max(0, taxAmount),
            TotalDiscount = Math.Max(0, totalDiscount),
            TotalAmount = totalAmount > 0 ? totalAmount : Math.Round(subtotalZero + subtotalTaxed + subtotalNoSubject + subtotalExempt + taxAmount, 2, MidpointRounding.AwayFromZero),
            PaymentMethodCode = paymentMethodCode?.Trim(),
            CreditDays = creditDays,
            ProformaId = proformaId,
            RawXml = rawXml,
            Notes = notes?.Trim(),
            Status = PurchaseStatus.Draft,
            CreatedAt = now,
            CreatedBy = createdBy
        };

        return Result.Success(purchase);
    }

    public Result AddItem(PurchaseItem item)
    {
        if (item is null)
        {
            return Result.Failure(new Error("purchase.item.null", "El ítem no puede ser nulo.", ErrorType.Validation));
        }

        if (Status == PurchaseStatus.Received || Status == PurchaseStatus.Cancelled)
        {
            return Result.Failure(new Error("purchase.modify.invalid_status", "No se pueden modificar ítems de una compra ya recibida o cancelada.", ErrorType.Validation));
        }

        _items.Add(item);
        RecalculateTotalsFromItems();
        return Result.Success();
    }

    public Result MarkAsReceived(Guid? inventoryDocumentId = null, Guid? updatedBy = null)
    {
        if (Status == PurchaseStatus.Received)
        {
            return Result.Failure(new Error("purchase.receive.already_received", "La compra ya se encuentra en estado recibida.", ErrorType.Validation));
        }

        if (Status == PurchaseStatus.Cancelled)
        {
            return Result.Failure(new Error("purchase.receive.cancelled", "No se puede recibir una compra cancelada.", ErrorType.Validation));
        }

        Status = PurchaseStatus.Received;
        InventoryDocumentId = inventoryDocumentId;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result Cancel(string? reason = null, Guid? updatedBy = null)
    {
        if (Status == PurchaseStatus.Cancelled)
        {
            return Result.Failure(new Error("purchase.cancel.already_cancelled", "La compra ya se encuentra cancelada.", ErrorType.Validation));
        }

        Status = PurchaseStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? $"Anulación: {reason.Trim()}" : $"{Notes} | Anulación: {reason.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public void AssignExpenseType(Guid expenseTypeId, string sriSustentoCode, Guid? updatedBy = null)
    {
        ExpenseTypeId = expenseTypeId;
        SriSustentoCode = sriSustentoCode;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private void RecalculateTotalsFromItems()
    {
        decimal zero = 0;
        decimal taxed = 0;
        decimal tax = 0;
        decimal discount = 0;

        foreach (var item in _items)
        {
            if (item.TaxRate == 0)
            {
                zero += item.Subtotal;
            }
            else
            {
                taxed += item.Subtotal;
                tax += item.TaxAmount;
            }
            discount += item.Discount;
        }

        SubtotalZero = Math.Round(zero, 2, MidpointRounding.AwayFromZero);
        SubtotalTaxed = Math.Round(taxed, 2, MidpointRounding.AwayFromZero);
        TaxAmount = Math.Round(tax, 2, MidpointRounding.AwayFromZero);
        TotalDiscount = Math.Round(discount, 2, MidpointRounding.AwayFromZero);
        TotalAmount = Math.Round(SubtotalZero + SubtotalTaxed + SubtotalNoSubject + SubtotalExempt + TaxAmount, 2, MidpointRounding.AwayFromZero);
    }
}
