using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Inventory.Queries.ListInventoryMovements;

public sealed class ListInventoryMovementsHandler
    : IQueryHandler<ListInventoryMovementsQuery, IReadOnlyList<InventoryMovementListItemResponse>>
{
    private readonly IInventoryMovementRepository _movements;
    private readonly ICatalogItemRepository _items;
    private readonly IWarehouseRepository _warehouses;

    public ListInventoryMovementsHandler(
        IInventoryMovementRepository movements,
        ICatalogItemRepository items,
        IWarehouseRepository warehouses)
    {
        _movements = movements;
        _items = items;
        _warehouses = warehouses;
    }

    public async Task<Result<IReadOnlyList<InventoryMovementListItemResponse>>> Handle(
        ListInventoryMovementsQuery query,
        CancellationToken ct)
    {
        var rows = await _movements
            .ListByTenantAsync(query.TenantId, query.WarehouseId, query.CatalogItemId, ct)
            .ConfigureAwait(false);
        var items = (await _items.ListActiveByTenantAsync(query.TenantId, CatalogItemKind.Physical, ct)
            .ConfigureAwait(false)).ToDictionary(i => i.Id);
        var warehouses = (await _warehouses.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false))
            .ToDictionary(w => w.Id);

        IReadOnlyList<InventoryMovementListItemResponse> list = rows
            .Select(m => new InventoryMovementListItemResponse(
                m.Id,
                m.CatalogItemId,
                items.TryGetValue(m.CatalogItemId, out var item) ? item.Name : "—",
                m.WarehouseId,
                warehouses.TryGetValue(m.WarehouseId, out var wh) ? wh.Name : "—",
                m.DocumentId,
                m.Direction,
                m.Quantity,
                m.OccurredAt))
            .ToList();
        return Result.Success(list);
    }
}
