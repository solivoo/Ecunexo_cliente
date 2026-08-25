using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Business.Inventory.Commands.ReceiveInventoryTransfer;

public sealed class ReceiveInventoryTransferHandler
    : ICommandHandler<ReceiveInventoryTransferCommand, ReceiveInventoryTransferResponse>
{
    private readonly IInventoryDocumentRepository _documents;
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly ICatalogItemRepository _items;
    private readonly InventoryDocumentApprovalService _approval;
    private readonly IUnitOfWork _unitOfWork;

    public ReceiveInventoryTransferHandler(
        IInventoryDocumentRepository documents,
        IWarehouseRepository warehouses,
        DefaultWarehouseProvisioner warehouseProvisioner,
        ICatalogItemRepository items,
        InventoryDocumentApprovalService approval,
        IUnitOfWork unitOfWork)
    {
        _documents = documents;
        _warehouses = warehouses;
        _warehouseProvisioner = warehouseProvisioner;
        _items = items;
        _approval = approval;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReceiveInventoryTransferResponse>> Handle(
        ReceiveInventoryTransferCommand command,
        CancellationToken ct)
    {
        var document = await _documents
            .GetTrackedWithLinesAsync(command.TenantId, command.DocumentId, ct)
            .ConfigureAwait(false);
        if (document is null)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(
                new Error("inventory.document.not_found", "El documento no existe.", ErrorType.NotFound));
        }

        if (document.DocumentType != InventoryDocumentType.Transfer)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(
                new Error(
                    "inventory.document.receive.type",
                    "Solo se recibe una transferencia.",
                    ErrorType.Conflict));
        }

        if (document.DestinationWarehouseId is null)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(
                new Error(
                    "inventory.document.transfer.destination.required",
                    "La transferencia no tiene bodega destino.",
                    ErrorType.Conflict));
        }

        await _warehouseProvisioner.EnsureAsync(command.TenantId, ct).ConfigureAwait(false);

        var transit = await _warehouses
            .GetActiveSystemByRoleAsync(command.TenantId, WarehouseSystemRole.Transit, ct)
            .ConfigureAwait(false);
        if (transit is null)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(
                new Error(
                    "warehousing.warehouse.transit.required",
                    "Falta la bodega de sistema En tránsito.",
                    ErrorType.Conflict));
        }

        var destination = await _warehouses
            .GetActiveByIdAsync(command.TenantId, document.DestinationWarehouseId.Value, ct)
            .ConfigureAwait(false);
        if (destination is null)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(
                new Error(
                    "warehousing.warehouse.destination.not_found",
                    "La bodega destino no existe.",
                    ErrorType.NotFound));
        }

        var itemIds = document.Lines.Select(l => l.CatalogItemId).Distinct().ToList();
        var catalogItems = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);

        var received = await _approval
            .ReceiveTransferAsync(document, transit, destination, catalogItems, ct)
            .ConfigureAwait(false);
        if (received.IsFailure)
        {
            return Result.Failure<ReceiveInventoryTransferResponse>(received.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new ReceiveInventoryTransferResponse(document.Id, document.Status));
    }
}
