using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.Inventory;

/// <summary>Fila de kárdex. Solo INSERT (ADR-010).</summary>
public sealed class InventoryMovement : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    private InventoryMovement()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public CatalogItem? CatalogItem { get; private set; }

    public Guid WarehouseId { get; private set; }

    public Warehouse? Warehouse { get; private set; }

    public Guid DocumentId { get; private set; }

    public InventoryDocument? Document { get; private set; }

    public InventoryMovementDirection Direction { get; private set; }

    public decimal Quantity { get; private set; }

    /// <summary>Costo unitario aplicado al movimiento (ingreso: capturado; egreso: promedio vigente).</summary>
    public decimal? UnitCost { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<InventoryMovement> Create(
        Guid id,
        Guid tenantId,
        Guid catalogItemId,
        Guid warehouseId,
        Guid documentId,
        InventoryMovementDirection direction,
        decimal quantity,
        DateTimeOffset occurredAt,
        Guid? createdBy,
        decimal? unitCost = null)
    {
        if (tenantId == Guid.Empty || catalogItemId == Guid.Empty || warehouseId == Guid.Empty || documentId == Guid.Empty)
        {
            return Result.Failure<InventoryMovement>(
                new Error("inventory.movement.keys.invalid", "Faltan claves del movimiento.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(direction))
        {
            return Result.Failure<InventoryMovement>(
                new Error("inventory.movement.direction.invalid", "La dirección del movimiento no es válida.", ErrorType.Validation));
        }

        var qty = InventoryQuantity.NormalizePositive(quantity);
        if (qty.IsFailure)
        {
            return Result.Failure<InventoryMovement>(qty.Error!);
        }

        decimal? normalizedCost = null;
        if (unitCost is decimal cost)
        {
            if (cost < 0)
            {
                return Result.Failure<InventoryMovement>(
                    new Error("inventory.movement.cost.range", "El costo unitario no puede ser negativo.", ErrorType.Validation));
            }

            normalizedCost = decimal.Round(cost, 4, MidpointRounding.AwayFromZero);
        }

        return new InventoryMovement
        {
            Id = id,
            TenantId = tenantId,
            CatalogItemId = catalogItemId,
            WarehouseId = warehouseId,
            DocumentId = documentId,
            Direction = direction,
            Quantity = qty.Value,
            UnitCost = normalizedCost,
            OccurredAt = occurredAt,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }
}
