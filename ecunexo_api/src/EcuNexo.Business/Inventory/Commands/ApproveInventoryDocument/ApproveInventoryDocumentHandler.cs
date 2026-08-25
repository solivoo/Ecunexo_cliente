using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Business.Inventory.Commands.ApproveInventoryDocument;

public sealed class ApproveInventoryDocumentHandler
    : ICommandHandler<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse>
{
    private readonly IInventoryDocumentRepository _documents;
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly ICatalogItemRepository _items;
    private readonly InventoryDocumentApprovalService _approval;
    private readonly IUnitOfWork _unitOfWork;

    public ApproveInventoryDocumentHandler(
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

    public async Task<Result<ApproveInventoryDocumentResponse>> Handle(
        ApproveInventoryDocumentCommand command,
        CancellationToken ct)
    {
        var document = await _documents
            .GetTrackedWithLinesAsync(command.TenantId, command.DocumentId, ct)
            .ConfigureAwait(false);
        if (document is null)
        {
            return Result.Failure<ApproveInventoryDocumentResponse>(
                new Error("inventory.document.not_found", "El documento no existe.", ErrorType.NotFound));
        }

        var itemIds = document.Lines.Select(l => l.CatalogItemId).Distinct().ToList();
        var catalogItems = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);

        if (document.DocumentType == InventoryDocumentType.Transfer)
        {
            await _warehouseProvisioner.EnsureAsync(command.TenantId, ct).ConfigureAwait(false);

            var origin = await _warehouses.GetActiveByIdAsync(command.TenantId, document.WarehouseId, ct)
                .ConfigureAwait(false);
            if (origin is null)
            {
                return Result.Failure<ApproveInventoryDocumentResponse>(
                    new Error("warehousing.warehouse.not_found", "La bodega origen no existe.", ErrorType.NotFound));
            }

            var transit = await _warehouses
                .GetActiveSystemByRoleAsync(command.TenantId, WarehouseSystemRole.Transit, ct)
                .ConfigureAwait(false);
            if (transit is null)
            {
                return Result.Failure<ApproveInventoryDocumentResponse>(
                    new Error(
                        "warehousing.warehouse.transit.required",
                        "Falta la bodega de sistema En tránsito.",
                        ErrorType.Conflict));
            }

            var shipped = await _approval
                .ShipTransferAsync(document, origin, transit, catalogItems, ct)
                .ConfigureAwait(false);
            if (shipped.IsFailure)
            {
                return Result.Failure<ApproveInventoryDocumentResponse>(shipped.Error!);
            }
        }
        else
        {
            var warehouse = await _warehouses.GetActiveByIdAsync(command.TenantId, document.WarehouseId, ct)
                .ConfigureAwait(false);
            if (warehouse is null)
            {
                return Result.Failure<ApproveInventoryDocumentResponse>(
                    new Error("warehousing.warehouse.not_found", "La bodega no existe.", ErrorType.NotFound));
            }

            var posted = await _approval.ApproveAsync(document, warehouse, catalogItems, ct).ConfigureAwait(false);
            if (posted.IsFailure)
            {
                return Result.Failure<ApproveInventoryDocumentResponse>(posted.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new ApproveInventoryDocumentResponse(document.Id, document.Status));
    }
}
