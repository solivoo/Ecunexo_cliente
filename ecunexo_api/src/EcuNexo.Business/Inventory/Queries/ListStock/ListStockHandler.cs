using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Inventory.Queries.ListStock;

public sealed class ListStockHandler : IQueryHandler<ListStockQuery, IReadOnlyList<StockListItemResponse>>
{
    private readonly IStockRepository _stocks;
    private readonly ICatalogItemRepository _items;
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _defaults;

    public ListStockHandler(
        IStockRepository stocks,
        ICatalogItemRepository items,
        IWarehouseRepository warehouses,
        DefaultWarehouseProvisioner defaults)
    {
        _stocks = stocks;
        _items = items;
        _warehouses = warehouses;
        _defaults = defaults;
    }

    public async Task<Result<IReadOnlyList<StockListItemResponse>>> Handle(
        ListStockQuery query,
        CancellationToken ct)
    {
        await _defaults.EnsureAsync(query.TenantId, ct).ConfigureAwait(false);

        var stocks = await _stocks.ListByTenantAsync(query.TenantId, query.WarehouseId, ct).ConfigureAwait(false);
        var items = (await _items.ListActiveByTenantAsync(query.TenantId, CatalogItemKind.Physical, ct)
            .ConfigureAwait(false)).ToDictionary(i => i.Id);
        var warehouses = (await _warehouses.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false))
            .ToDictionary(w => w.Id);

        IEnumerable<Core.Inventory.Stock> filtered = stocks;
        if (query.BelowMinimumOnly)
        {
            filtered = stocks.Where(s => s.IsBelowMinimum);
        }

        IReadOnlyList<StockListItemResponse> rows = filtered
            .Select(s => new StockListItemResponse(
                s.Id,
                s.CatalogItemId,
                items.TryGetValue(s.CatalogItemId, out var item) ? item.Name : "—",
                items.TryGetValue(s.CatalogItemId, out var item2) ? item2.Sku : null,
                s.WarehouseId,
                warehouses.TryGetValue(s.WarehouseId, out var wh) ? wh.Name : "—",
                s.Quantity,
                s.MinimumQuantity,
                s.IsBelowMinimum,
                s.UpdatedAt ?? s.CreatedAt,
                items.TryGetValue(s.CatalogItemId, out var itemAttr) ? itemAttr.CustomAttributesJson : null))
            .OrderByDescending(r => r.IsBelowMinimum)
            .ThenBy(r => r.WarehouseName)
            .ThenBy(r => r.CatalogItemName)
            .ToList();
        return Result.Success(rows);
    }
}
