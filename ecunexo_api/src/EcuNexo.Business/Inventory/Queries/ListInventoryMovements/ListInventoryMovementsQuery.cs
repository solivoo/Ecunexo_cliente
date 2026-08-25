using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Queries.ListInventoryMovements;

public sealed record ListInventoryMovementsQuery(
    Guid TenantId,
    Guid? WarehouseId = null,
    Guid? CatalogItemId = null) : IQuery<IReadOnlyList<InventoryMovementListItemResponse>>;

public sealed record InventoryMovementListItemResponse(
    Guid Id,
    Guid CatalogItemId,
    string CatalogItemName,
    Guid WarehouseId,
    string WarehouseName,
    Guid DocumentId,
    InventoryMovementDirection Direction,
    decimal Quantity,
    DateTimeOffset OccurredAt);
