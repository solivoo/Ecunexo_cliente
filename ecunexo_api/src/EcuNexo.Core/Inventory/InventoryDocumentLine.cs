using EcuNexo.Core.Common;

namespace EcuNexo.Core.Inventory;

public sealed class InventoryDocumentLine : Entity<Guid>
{
    private InventoryDocumentLine()
    {
    }

    public Guid DocumentId { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public decimal Quantity { get; private set; }

    public static Result<InventoryDocumentLine> Create(
        Guid id,
        Guid documentId,
        Guid catalogItemId,
        decimal quantity,
        bool allowZero = false)
    {
        if (documentId == Guid.Empty || catalogItemId == Guid.Empty)
        {
            return Result.Failure<InventoryDocumentLine>(
                new Error("inventory.document.line.keys.invalid", "Ítem y documento son obligatorios.", ErrorType.Validation));
        }

        var qty = allowZero
            ? InventoryQuantity.NormalizeNonNegative(quantity)
            : InventoryQuantity.NormalizePositive(quantity);
        if (qty.IsFailure)
        {
            return Result.Failure<InventoryDocumentLine>(qty.Error!);
        }

        return new InventoryDocumentLine
        {
            Id = id,
            DocumentId = documentId,
            CatalogItemId = catalogItemId,
            Quantity = qty.Value,
        };
    }
}
