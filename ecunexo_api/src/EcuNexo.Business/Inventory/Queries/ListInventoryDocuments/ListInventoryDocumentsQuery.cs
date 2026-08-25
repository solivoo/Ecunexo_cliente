using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Queries.ListInventoryDocuments;

public sealed record ListInventoryDocumentsQuery(Guid TenantId)
    : IQuery<IReadOnlyList<InventoryDocumentListItemResponse>>;

public sealed record InventoryDocumentListItemResponse(
    Guid Id,
    InventoryDocumentType DocumentType,
    InventoryDocumentStatus Status,
    Guid WarehouseId,
    string WarehouseName,
    Guid? DestinationWarehouseId,
    string? DestinationWarehouseName,
    int LineCount,
    string? Notes,
    InventoryReceiptOrigin? ReceiptOrigin,
    string? SourceDocumentNumber,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ApprovedAt);
