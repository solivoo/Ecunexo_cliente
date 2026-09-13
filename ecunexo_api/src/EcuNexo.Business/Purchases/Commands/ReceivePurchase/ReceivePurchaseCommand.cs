using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory.Commands.ApproveInventoryDocument;
using EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Commands.ReceivePurchase;

public sealed record PurchaseLineWarehouseMapping(
    Guid LineId,
    Guid CatalogItemId,
    Guid WarehouseId);

public sealed record ReceivePurchaseCommand(
    Guid TenantId,
    Guid PurchaseId,
    Guid? DefaultWarehouseId = null,
    IReadOnlyList<PurchaseLineWarehouseMapping>? LineMappings = null,
    Guid? UserId = null) : ICommand<ReceivePurchaseResponse>;

public sealed record ReceivePurchaseResponse(
    Guid PurchaseId,
    PurchaseStatus Status,
    Guid? InventoryDocumentId,
    int ItemsReceivedInStock);

public sealed class ReceivePurchaseHandler : ICommandHandler<ReceivePurchaseCommand, ReceivePurchaseResponse>
{
    private readonly IPurchaseRepository _purchases;
    private readonly ICommandHandler<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse> _createInventoryDoc;
    private readonly ICommandHandler<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse> _approveInventoryDoc;
    private readonly IUnitOfWork _unitOfWork;

    public ReceivePurchaseHandler(
        IPurchaseRepository purchases,
        ICommandHandler<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse> createInventoryDoc,
        ICommandHandler<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse> approveInventoryDoc,
        IUnitOfWork unitOfWork)
    {
        _purchases = purchases;
        _createInventoryDoc = createInventoryDoc;
        _approveInventoryDoc = approveInventoryDoc;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReceivePurchaseResponse>> Handle(
        ReceivePurchaseCommand command,
        CancellationToken ct)
    {
        var purchase = await _purchases.GetTrackedByIdAsync(command.TenantId, command.PurchaseId, ct).ConfigureAwait(false);
        if (purchase is null)
        {
            return Result.Failure<ReceivePurchaseResponse>(
                new Error("purchases.receive.not_found", "La factura de compra no existe.", ErrorType.NotFound));
        }

        if (purchase.Status != PurchaseStatus.Draft)
        {
            return Result.Failure<ReceivePurchaseResponse>(
                new Error("purchases.receive.invalid_status", $"Solo compras en estado 'Borrador' pueden ser recibidas. Estado actual: {purchase.Status}.", ErrorType.Validation));
        }

        // 1. Aplicar mapeos manuales de bodega o ítem de catálogo si se enviaron
        if (command.LineMappings is not null && command.LineMappings.Count > 0)
        {
            var mapDict = command.LineMappings.ToDictionary(m => m.LineId);
            foreach (var item in purchase.Items)
            {
                if (mapDict.TryGetValue(item.Id, out var mapping))
                {
                    item.LinkCatalogItem(mapping.CatalogItemId, mapping.WarehouseId, true);
                }
            }
        }

        // 2. Identificar ítems que afectan inventario
        var inventoryItems = purchase.Items.Where(i => i.AffectsInventory).ToList();
        Guid? firstInventoryDocId = null;
        var totalItemsReceived = 0;

        if (inventoryItems.Count > 0)
        {
            // Validar que cada ítem que afecta inventario tenga catálogo y bodega
            foreach (var item in inventoryItems)
            {
                var warehouseId = item.WarehouseId ?? command.DefaultWarehouseId;
                if (!warehouseId.HasValue || warehouseId.Value == Guid.Empty)
                {
                    return Result.Failure<ReceivePurchaseResponse>(
                        new Error("purchases.receive.warehouse_missing", $"El ítem '{item.Description}' requiere una bodega asignada para ingresar al inventario.", ErrorType.Validation));
                }

                if (!item.CatalogItemId.HasValue || item.CatalogItemId.Value == Guid.Empty)
                {
                    return Result.Failure<ReceivePurchaseResponse>(
                        new Error("purchases.receive.catalog_item_missing", $"El ítem '{item.Description}' debe estar vinculado a un producto de catálogo para registrar stock y kárdex.", ErrorType.Validation));
                }
            }

            // Agrupar por bodega de destino para generar el o los documentos de ingreso
            var byWarehouse = inventoryItems
                .GroupBy(i => i.WarehouseId ?? command.DefaultWarehouseId!.Value);

            foreach (var group in byWarehouse)
            {
                var warehouseId = group.Key;
                var linesInput = group
                    .Select(i => new CreateInventoryDocumentLineInput(i.CatalogItemId!.Value, i.Quantity))
                    .ToList();

                var createDocCmd = new CreateInventoryDocumentCommand(
                    TenantId: command.TenantId,
                    DocumentType: InventoryDocumentType.Receipt,
                    WarehouseId: warehouseId,
                    Lines: linesInput,
                    Notes: $"Ingreso por compra factura {purchase.InvoiceNumber}",
                    ReceiptOrigin: InventoryReceiptOrigin.Purchase,
                    SourceDocumentNumber: purchase.InvoiceNumber
                );

                var createDocResult = await _createInventoryDoc.Handle(createDocCmd, ct).ConfigureAwait(false);
                if (createDocResult.IsFailure)
                {
                    return Result.Failure<ReceivePurchaseResponse>(createDocResult.Error!);
                }

                var docId = createDocResult.Value!.DocumentId;
                firstInventoryDocId ??= docId;

                // Aprobar inmediatamente el ingreso para asentar en balances y kárdex
                var approveCmd = new ApproveInventoryDocumentCommand(command.TenantId, docId);
                var approveResult = await _approveInventoryDoc.Handle(approveCmd, ct).ConfigureAwait(false);
                if (approveResult.IsFailure)
                {
                    return Result.Failure<ReceivePurchaseResponse>(approveResult.Error!);
                }

                totalItemsReceived += linesInput.Count;
            }
        }

        // 3. Marcar la compra como Recibida
        var markResult = purchase.MarkAsReceived(firstInventoryDocId, command.UserId);
        if (markResult.IsFailure)
        {
            return Result.Failure<ReceivePurchaseResponse>(markResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new ReceivePurchaseResponse(
            PurchaseId: purchase.Id,
            Status: purchase.Status,
            InventoryDocumentId: firstInventoryDocId,
            ItemsReceivedInStock: totalItemsReceived));
    }
}
