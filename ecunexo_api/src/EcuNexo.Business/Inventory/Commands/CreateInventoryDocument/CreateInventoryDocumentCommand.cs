using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;

public sealed record CreateInventoryDocumentLineInput(Guid CatalogItemId, decimal Quantity);

public sealed record CreateInventoryDocumentCommand(
    Guid TenantId,
    InventoryDocumentType DocumentType,
    Guid WarehouseId,
    IReadOnlyList<CreateInventoryDocumentLineInput> Lines,
    string? Notes = null,
    Guid? DestinationWarehouseId = null,
    InventoryReceiptOrigin? ReceiptOrigin = null,
    string? SourceDocumentNumber = null) : ICommand<CreateInventoryDocumentResponse>;

public sealed record CreateInventoryDocumentResponse(Guid DocumentId, Guid TenantId, InventoryDocumentStatus Status);
