using EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Api.Contracts.V1.Inventory;

public sealed record CreateInventoryDocumentLineRequest(
    Guid CatalogItemId,
    decimal Quantity,
    decimal? UnitCost = null);

public sealed record CreateInventoryDocumentRequest(
    InventoryDocumentType DocumentType,
    Guid WarehouseId,
    IReadOnlyList<CreateInventoryDocumentLineRequest> Lines,
    string? Notes = null,
    Guid? DestinationWarehouseId = null,
    InventoryReceiptOrigin? ReceiptOrigin = null,
    string? SourceDocumentNumber = null)
{
    public CreateInventoryDocumentCommand ToCommand(Guid tenantId) =>
        new(
            tenantId,
            DocumentType,
            WarehouseId,
            Lines.Select(l => new CreateInventoryDocumentLineInput(l.CatalogItemId, l.Quantity, l.UnitCost)).ToList(),
            Notes,
            DestinationWarehouseId,
            ReceiptOrigin,
            SourceDocumentNumber);
}
