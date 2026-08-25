using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Inventory.Queries.GetInventoryDocument;

public sealed class GetInventoryDocumentHandler
    : IQueryHandler<GetInventoryDocumentQuery, InventoryDocumentDetailResponse>
{
    private readonly IInventoryDocumentRepository _documents;
    private readonly IWarehouseRepository _warehouses;
    private readonly ICatalogItemRepository _items;

    public GetInventoryDocumentHandler(
        IInventoryDocumentRepository documents,
        IWarehouseRepository warehouses,
        ICatalogItemRepository items)
    {
        _documents = documents;
        _warehouses = warehouses;
        _items = items;
    }

    public async Task<Result<InventoryDocumentDetailResponse>> Handle(
        GetInventoryDocumentQuery query,
        CancellationToken ct)
    {
        var document = await _documents.GetByIdAsync(query.TenantId, query.DocumentId, ct).ConfigureAwait(false);
        if (document is null)
        {
            return Result.Failure<InventoryDocumentDetailResponse>(
                new Error("inventory.document.not_found", "El documento no existe.", ErrorType.NotFound));
        }

        var warehouse = await _warehouses.GetActiveByIdAsync(query.TenantId, document.WarehouseId, ct)
            .ConfigureAwait(false);
        string? destinationName = null;
        if (document.DestinationWarehouseId is Guid destinationId)
        {
            var destination = await _warehouses.GetActiveByIdAsync(query.TenantId, destinationId, ct)
                .ConfigureAwait(false);
            destinationName = destination?.Name;
        }

        var itemIds = document.Lines.Select(l => l.CatalogItemId).Distinct().ToList();
        var items = (await _items.GetActiveByIdsAsync(query.TenantId, itemIds, ct).ConfigureAwait(false))
            .ToDictionary(i => i.Id);

        return Result.Success(
            new InventoryDocumentDetailResponse(
                document.Id,
                document.DocumentType,
                document.Status,
                document.WarehouseId,
                warehouse?.Name ?? "—",
                document.DestinationWarehouseId,
                destinationName,
                document.Notes,
                document.ReceiptOrigin,
                document.SourceDocumentNumber,
                document.CreatedAt,
                document.ShippedAt,
                document.ApprovedAt,
                document.Lines
                    .Select(l => new InventoryDocumentLineResponse(
                        l.CatalogItemId,
                        items.TryGetValue(l.CatalogItemId, out var item) ? item.Name : "—",
                        l.Quantity))
                    .ToList()));
    }
}
