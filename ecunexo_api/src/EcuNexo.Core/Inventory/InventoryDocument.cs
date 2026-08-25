using System.Text.RegularExpressions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.Inventory;

/// <summary>
/// Cabecera logística. El kárdex y <see cref="Stock"/> solo cambian al aprobar (ADR-010).
/// Transferencias: Draft → InTransit (origen→tránsito) → Approved (tránsito→destino).
/// </summary>
public sealed class InventoryDocument : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NotesMaxLength = 500;

    public const int SourceDocumentNumberMaxLength = 20;

    private static readonly Regex PurchaseInvoiceNumberPattern = new(
        @"^\d{3}-\d{3}-\d{9}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled,
        TimeSpan.FromMilliseconds(100));

    private readonly List<InventoryDocumentLine> _lines = [];

    private InventoryDocument()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public InventoryDocumentType DocumentType { get; private set; }

    public InventoryDocumentStatus Status { get; private set; }

    /// <summary>Bodega operativa de recepción/egreso, o origen en traspasos.</summary>
    public Guid WarehouseId { get; private set; }

    public Warehouse? Warehouse { get; private set; }

    /// <summary>Destino del traspaso. Null en recepción/egreso.</summary>
    public Guid? DestinationWarehouseId { get; private set; }

    public Warehouse? DestinationWarehouse { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>Solo recepción. Inventario inicial, compra, devolución u otro.</summary>
    public InventoryReceiptOrigin? ReceiptOrigin { get; private set; }

    /// <summary>Nº de factura de compra (001-001-000000123). Solo si el origen es compra.</summary>
    public string? SourceDocumentNumber { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public Guid? ApprovedBy { get; private set; }

    public DateTimeOffset? ShippedAt { get; private set; }

    public Guid? ShippedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyList<InventoryDocumentLine> Lines => _lines;

    public static Result<InventoryDocument> Create(
        Guid id,
        Guid tenantId,
        InventoryDocumentType documentType,
        Guid warehouseId,
        string? notes,
        IReadOnlyList<(Guid LineId, Guid CatalogItemId, decimal Quantity)> lines,
        Guid? destinationWarehouseId = null,
        InventoryReceiptOrigin? receiptOrigin = null,
        string? sourceDocumentNumber = null)
    {
        if (tenantId == Guid.Empty || warehouseId == Guid.Empty)
        {
            return Result.Failure<InventoryDocument>(
                new Error("inventory.document.keys.invalid", "Tenant y bodega son obligatorios.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(documentType)
            || documentType is not (
                InventoryDocumentType.Receipt
                or InventoryDocumentType.Issue
                or InventoryDocumentType.Transfer
                or InventoryDocumentType.Adjustment))
        {
            return Result.Failure<InventoryDocument>(
                new Error(
                    "inventory.document.type.invalid",
                    "El tipo de documento debe ser recepción, egreso, transferencia o ajuste.",
                    ErrorType.Validation));
        }

        if (documentType == InventoryDocumentType.Transfer)
        {
            if (destinationWarehouseId is null || destinationWarehouseId == Guid.Empty)
            {
                return Result.Failure<InventoryDocument>(
                    new Error(
                        "inventory.document.transfer.destination.required",
                        "La transferencia requiere bodega destino.",
                        ErrorType.Validation));
            }

            if (destinationWarehouseId == warehouseId)
            {
                return Result.Failure<InventoryDocument>(
                    new Error(
                        "inventory.document.transfer.same_warehouse",
                        "Origen y destino deben ser bodegas distintas.",
                        ErrorType.Validation));
            }
        }
        else if (destinationWarehouseId is not null)
        {
            return Result.Failure<InventoryDocument>(
                new Error(
                    "inventory.document.destination.not_allowed",
                    "Solo las transferencias admiten bodega destino.",
                    ErrorType.Validation));
        }

        var notesResult = NormalizeNotes(notes);
        if (notesResult.IsFailure)
        {
            return Result.Failure<InventoryDocument>(notesResult.Error!);
        }

        var originResult = NormalizeReceiptOrigin(documentType, receiptOrigin, sourceDocumentNumber);
        if (originResult.IsFailure)
        {
            return Result.Failure<InventoryDocument>(originResult.Error!);
        }

        // El ajuste exige motivo auditable (quién/por qué se corrigió el saldo).
        if (documentType == InventoryDocumentType.Adjustment
            && string.IsNullOrWhiteSpace(notesResult.Value))
        {
            return Result.Failure<InventoryDocument>(
                new Error(
                    "inventory.document.adjustment.notes.required",
                    "El ajuste requiere una nota con el motivo del conteo.",
                    ErrorType.Validation));
        }

        if (lines.Count == 0)
        {
            return Result.Failure<InventoryDocument>(
                new Error("inventory.document.lines.required", "El documento requiere al menos una línea.", ErrorType.Validation));
        }

        var document = new InventoryDocument
        {
            Id = id,
            TenantId = tenantId,
            DocumentType = documentType,
            Status = InventoryDocumentStatus.Draft,
            WarehouseId = warehouseId,
            DestinationWarehouseId = destinationWarehouseId,
            Notes = notesResult.Value,
            ReceiptOrigin = originResult.Value.Origin,
            SourceDocumentNumber = originResult.Value.Number,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var allowZeroQty = documentType == InventoryDocumentType.Adjustment;
        foreach (var line in lines)
        {
            var created = InventoryDocumentLine.Create(
                line.LineId,
                id,
                line.CatalogItemId,
                line.Quantity,
                allowZeroQty);
            if (created.IsFailure)
            {
                return Result.Failure<InventoryDocument>(created.Error!);
            }

            document._lines.Add(created.Value!);
        }

        return Result.Success(document);
    }

    public Result MarkApproved(DateTimeOffset approvedAt, Guid? approvedBy)
    {
        if (DocumentType == InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.approve.transfer",
                    "Una transferencia se completa con recepción, no con aprobación directa.",
                    ErrorType.Conflict));
        }

        if (Status != InventoryDocumentStatus.Draft)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.approve.state",
                    "Solo se puede aprobar un documento en borrador.",
                    ErrorType.Conflict));
        }

        Status = InventoryDocumentStatus.Approved;
        ApprovedAt = approvedAt;
        ApprovedBy = approvedBy;
        Touch(approvedBy);
        return Result.Success();
    }

    public Result MarkShipped(DateTimeOffset shippedAt, Guid? shippedBy)
    {
        if (DocumentType != InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.ship.type",
                    "Solo se despacha una transferencia.",
                    ErrorType.Conflict));
        }

        if (Status != InventoryDocumentStatus.Draft)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.ship.state",
                    "Solo se puede despachar una transferencia en borrador.",
                    ErrorType.Conflict));
        }

        Status = InventoryDocumentStatus.InTransit;
        ShippedAt = shippedAt;
        ShippedBy = shippedBy;
        Touch(shippedBy);
        return Result.Success();
    }

    public Result MarkReceived(DateTimeOffset receivedAt, Guid? receivedBy)
    {
        if (DocumentType != InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.receive.type",
                    "Solo se recibe una transferencia.",
                    ErrorType.Conflict));
        }

        if (Status != InventoryDocumentStatus.InTransit)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.receive.state",
                    "Solo se puede recibir una transferencia en tránsito.",
                    ErrorType.Conflict));
        }

        Status = InventoryDocumentStatus.Approved;
        ApprovedAt = receivedAt;
        ApprovedBy = receivedBy;
        Touch(receivedBy);
        return Result.Success();
    }

    public Result Cancel(Guid? updatedBy)
    {
        if (Status == InventoryDocumentStatus.Approved || Status == InventoryDocumentStatus.InTransit)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.cancel.posted",
                    "Un documento con stock movido no se cancela: hay que emitir un movimiento de reversión.",
                    ErrorType.Conflict));
        }

        if (Status == InventoryDocumentStatus.Cancelled)
        {
            return Result.Failure(
                new Error("inventory.document.cancel.state", "El documento ya está anulado.", ErrorType.Conflict));
        }

        Status = InventoryDocumentStatus.Cancelled;
        Touch(updatedBy);
        return Result.Success();
    }

    public InventoryMovementDirection MovementDirection
    {
        get
        {
            if (DocumentType is InventoryDocumentType.Transfer or InventoryDocumentType.Adjustment)
            {
                throw new InvalidOperationException(
                    "Transfer y ajuste no tienen una única dirección de movimiento.");
            }

            return DocumentType == InventoryDocumentType.Receipt
                ? InventoryMovementDirection.In
                : InventoryMovementDirection.Out;
        }
    }

    public static Result EnsureStockable(CatalogItem item)
    {
        if (item.Kind != CatalogItemKind.Physical)
        {
            return Result.Failure(
                new Error(
                    "catalog.item.not_stockable",
                    "Solo los ítems físicos pueden mover stock.",
                    ErrorType.Validation));
        }

        return Result.Success();
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result<string?> NormalizeNotes(string? notes)
    {
        if (notes is null)
        {
            return Result.Success<string?>(null);
        }

        var trimmed = notes.Trim();
        if (trimmed.Length > NotesMaxLength)
        {
            return Result.Failure<string?>(
                new Error(
                    "inventory.document.notes.length",
                    $"Las notas no pueden superar {NotesMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed.Length == 0 ? null : trimmed);
    }

    private readonly record struct ReceiptOriginNorm(InventoryReceiptOrigin? Origin, string? Number);

    private static Result<ReceiptOriginNorm> NormalizeReceiptOrigin(
        InventoryDocumentType documentType,
        InventoryReceiptOrigin? receiptOrigin,
        string? sourceDocumentNumber)
    {
        if (documentType != InventoryDocumentType.Receipt)
        {
            if (receiptOrigin is not null || !string.IsNullOrWhiteSpace(sourceDocumentNumber))
            {
                return Result.Failure<ReceiptOriginNorm>(
                    new Error(
                        "inventory.document.origin.not_allowed",
                        "Solo la recepción admite origen y número de documento.",
                        ErrorType.Validation));
            }

            return Result.Success(new ReceiptOriginNorm(null, null));
        }

        var origin = receiptOrigin ?? InventoryReceiptOrigin.Opening;
        if (!Enum.IsDefined(origin))
        {
            return Result.Failure<ReceiptOriginNorm>(
                new Error(
                    "inventory.document.origin.invalid",
                    "El origen de la recepción no es válido.",
                    ErrorType.Validation));
        }

        if (origin != InventoryReceiptOrigin.Purchase)
        {
            return Result.Success(new ReceiptOriginNorm(origin, null));
        }

        if (string.IsNullOrWhiteSpace(sourceDocumentNumber))
        {
            return Result.Failure<ReceiptOriginNorm>(
                new Error(
                    "inventory.document.purchase.number.required",
                    "La recepción por compra requiere el número de factura del proveedor.",
                    ErrorType.Validation));
        }

        var number = sourceDocumentNumber.Trim();
        if (number.Length > SourceDocumentNumberMaxLength || !PurchaseInvoiceNumberPattern.IsMatch(number))
        {
            return Result.Failure<ReceiptOriginNorm>(
                new Error(
                    "inventory.document.purchase.number.format",
                    "El número de factura debe ser 001-001-000000123 (establecimiento, punto y secuencial).",
                    ErrorType.Validation));
        }

        return Result.Success(new ReceiptOriginNorm(origin, number));
    }
}
