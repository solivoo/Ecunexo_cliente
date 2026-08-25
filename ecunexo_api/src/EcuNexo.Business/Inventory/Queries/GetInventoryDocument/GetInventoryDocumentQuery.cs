using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Queries.GetInventoryDocument;

public sealed record GetInventoryDocumentQuery(Guid TenantId, Guid DocumentId)
    : IQuery<InventoryDocumentDetailResponse>;

public sealed record InventoryDocumentLineResponse(Guid CatalogItemId, string CatalogItemName, decimal Quantity);

public sealed record InventoryDocumentDetailResponse(
    Guid Id,
    InventoryDocumentType DocumentType,
    InventoryDocumentStatus Status,
    Guid WarehouseId,
    string WarehouseName,
    Guid? DestinationWarehouseId,
    string? DestinationWarehouseName,
    string? Notes,
    InventoryReceiptOrigin? ReceiptOrigin,
    string? SourceDocumentNumber,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ShippedAt,
    DateTimeOffset? ApprovedAt,
    IReadOnlyList<InventoryDocumentLineResponse> Lines);
