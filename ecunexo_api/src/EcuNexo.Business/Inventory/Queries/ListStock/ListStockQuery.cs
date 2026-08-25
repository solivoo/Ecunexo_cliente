using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Inventory.Queries.ListStock;

public sealed record ListStockQuery(
    Guid TenantId,
    Guid? WarehouseId = null,
    bool BelowMinimumOnly = false) : IQuery<IReadOnlyList<StockListItemResponse>>;

public sealed record StockListItemResponse(
    Guid Id,
    Guid CatalogItemId,
    string CatalogItemName,
    string? Sku,
    Guid WarehouseId,
    string WarehouseName,
    decimal Quantity,
    decimal? MinimumQuantity,
    bool IsBelowMinimum,
    DateTimeOffset? UpdatedAt);
