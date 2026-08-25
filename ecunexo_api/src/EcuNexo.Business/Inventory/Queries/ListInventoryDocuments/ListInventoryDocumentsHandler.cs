using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Inventory.Queries.ListInventoryDocuments;

public sealed class ListInventoryDocumentsHandler
    : IQueryHandler<ListInventoryDocumentsQuery, IReadOnlyList<InventoryDocumentListItemResponse>>
{
    private readonly IInventoryDocumentRepository _documents;
    private readonly IWarehouseRepository _warehouses;

    public ListInventoryDocumentsHandler(
        IInventoryDocumentRepository documents,
        IWarehouseRepository warehouses)
    {
        _documents = documents;
        _warehouses = warehouses;
    }

    public async Task<Result<IReadOnlyList<InventoryDocumentListItemResponse>>> Handle(
        ListInventoryDocumentsQuery query,
        CancellationToken ct)
    {
        var docs = await _documents.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var warehouses = (await _warehouses.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false))
            .ToDictionary(w => w.Id);

        IReadOnlyList<InventoryDocumentListItemResponse> rows = docs
            .Select(d => new InventoryDocumentListItemResponse(
                d.Id,
                d.DocumentType,
                d.Status,
                d.WarehouseId,
                warehouses.TryGetValue(d.WarehouseId, out var wh) ? wh.Name : "—",
                d.DestinationWarehouseId,
                d.DestinationWarehouseId is Guid destId
                && warehouses.TryGetValue(destId, out var dest)
                    ? dest.Name
                    : null,
                d.Lines.Count,
                d.Notes,
                d.ReceiptOrigin,
                d.SourceDocumentNumber,
                d.CreatedAt,
                d.ApprovedAt))
            .ToList();
        return Result.Success(rows);
    }
}
