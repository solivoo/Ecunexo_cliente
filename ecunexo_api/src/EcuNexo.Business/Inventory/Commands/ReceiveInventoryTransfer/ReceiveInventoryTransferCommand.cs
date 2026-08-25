using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory.Commands.ReceiveInventoryTransfer;

public sealed record ReceiveInventoryTransferCommand(Guid TenantId, Guid DocumentId)
    : ICommand<ReceiveInventoryTransferResponse>;

public sealed record ReceiveInventoryTransferResponse(Guid DocumentId, InventoryDocumentStatus Status);
