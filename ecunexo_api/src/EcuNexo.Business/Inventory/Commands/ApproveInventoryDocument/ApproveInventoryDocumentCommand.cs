using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Commands.ApproveInventoryDocument;

public sealed record ApproveInventoryDocumentCommand(Guid TenantId, Guid DocumentId)
    : ICommand<ApproveInventoryDocumentResponse>;

public sealed record ApproveInventoryDocumentResponse(Guid DocumentId, InventoryDocumentStatus Status);
