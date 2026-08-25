using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Business.Inventory;

/// <summary>Aplica kárdex + saldo. Una sola UoW en el handler que llama (ADR-010).</summary>
public sealed class InventoryDocumentApprovalService
{
    private readonly IIdGenerator _idGenerator;
    private readonly IStockRepository _stocks;
    private readonly IInventoryMovementRepository _movements;

    public InventoryDocumentApprovalService(
        IIdGenerator idGenerator,
        IStockRepository stocks,
        IInventoryMovementRepository movements)
    {
        _idGenerator = idGenerator;
        _stocks = stocks;
        _movements = movements;
    }

    public async Task<Result> ApproveAsync(
        InventoryDocument document,
        Warehouse warehouse,
        IReadOnlyList<CatalogItem> items,
        CancellationToken ct,
        Guid? approvedBy = null)
    {
        if (document.DocumentType == InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.approve.transfer",
                    "Use el despacho de transferencia (approve) o la recepción.",
                    ErrorType.Conflict));
        }

        var operational = warehouse.EnsureOperational();
        if (operational.IsFailure)
        {
            return operational;
        }

        if (document.DocumentType == InventoryDocumentType.Adjustment)
        {
            var adjusted = await ApproveAdjustmentAsync(document, warehouse.Id, items, approvedBy, ct)
                .ConfigureAwait(false);
            if (adjusted.IsFailure)
            {
                return adjusted;
            }

            return document.MarkApproved(DateTimeOffset.UtcNow, approvedBy);
        }

        var posted = await PostLinesAsync(
                document,
                warehouse.Id,
                document.MovementDirection,
                items,
                approvedBy,
                DateTimeOffset.UtcNow,
                ct)
            .ConfigureAwait(false);
        if (posted.IsFailure)
        {
            return posted;
        }

        return document.MarkApproved(DateTimeOffset.UtcNow, approvedBy);
    }

    /// <summary>
    /// Conteo físico: Quantity de línea = saldo contado. Se postea solo el delta vs Stock actual.
    /// </summary>
    private async Task<Result> ApproveAdjustmentAsync(
        InventoryDocument document,
        Guid warehouseId,
        IReadOnlyList<CatalogItem> items,
        Guid? approvedBy,
        CancellationToken ct)
    {
        var itemsById = items.ToDictionary(i => i.Id);
        var now = DateTimeOffset.UtcNow;

        foreach (var line in document.Lines)
        {
            if (!itemsById.TryGetValue(line.CatalogItemId, out var item))
            {
                return Result.Failure(
                    new Error("catalog.item.not_found", "Uno o más ítems no existen.", ErrorType.NotFound));
            }

            var stockable = InventoryDocument.EnsureStockable(item);
            if (stockable.IsFailure)
            {
                return stockable;
            }

            var stock = await _stocks
                .GetTrackedAsync(document.TenantId, line.CatalogItemId, warehouseId, ct)
                .ConfigureAwait(false);
            if (stock is null)
            {
                var createdStock = Stock.Create(
                    _idGenerator.NewId(),
                    document.TenantId,
                    line.CatalogItemId,
                    warehouseId);
                if (createdStock.IsFailure)
                {
                    return Result.Failure(createdStock.Error!);
                }

                stock = createdStock.Value!;
                await _stocks.AddAsync(stock, ct).ConfigureAwait(false);
            }

            var delta = line.Quantity - stock.Quantity;
            if (delta == 0m)
            {
                // Conteo coincide: no se escribe kárdex (nada que corregir).
                continue;
            }

            var direction = delta > 0 ? InventoryMovementDirection.In : InventoryMovementDirection.Out;
            var absolute = Math.Abs(delta);

            var applied = direction == InventoryMovementDirection.In
                ? stock.Increase(absolute, approvedBy)
                : stock.Decrease(absolute, approvedBy);
            if (applied.IsFailure)
            {
                return applied;
            }

            var movement = InventoryMovement.Create(
                _idGenerator.NewId(),
                document.TenantId,
                line.CatalogItemId,
                warehouseId,
                document.Id,
                direction,
                absolute,
                now,
                approvedBy);
            if (movement.IsFailure)
            {
                return Result.Failure(movement.Error!);
            }

            await _movements.AddAsync(movement.Value!, ct).ConfigureAwait(false);
        }

        return Result.Success();
    }

    /// <summary>OUT origen + IN tránsito → estado InTransit.</summary>
    public async Task<Result> ShipTransferAsync(
        InventoryDocument document,
        Warehouse origin,
        Warehouse transit,
        IReadOnlyList<CatalogItem> items,
        CancellationToken ct,
        Guid? shippedBy = null)
    {
        if (document.DocumentType != InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.ship.type",
                    "Solo se despacha una transferencia.",
                    ErrorType.Conflict));
        }

        var originOk = origin.EnsureOperational();
        if (originOk.IsFailure)
        {
            return originOk;
        }

        if (!transit.IsTransit)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.transit.required",
                    "Falta la bodega de sistema En tránsito.",
                    ErrorType.Conflict));
        }

        var now = DateTimeOffset.UtcNow;
        var outPosted = await PostLinesAsync(
                document,
                origin.Id,
                InventoryMovementDirection.Out,
                items,
                shippedBy,
                now,
                ct)
            .ConfigureAwait(false);
        if (outPosted.IsFailure)
        {
            return outPosted;
        }

        var inPosted = await PostLinesAsync(
                document,
                transit.Id,
                InventoryMovementDirection.In,
                items,
                shippedBy,
                now,
                ct)
            .ConfigureAwait(false);
        if (inPosted.IsFailure)
        {
            return inPosted;
        }

        return document.MarkShipped(now, shippedBy);
    }

    /// <summary>OUT tránsito + IN destino → estado Approved.</summary>
    public async Task<Result> ReceiveTransferAsync(
        InventoryDocument document,
        Warehouse transit,
        Warehouse destination,
        IReadOnlyList<CatalogItem> items,
        CancellationToken ct,
        Guid? receivedBy = null)
    {
        if (document.DocumentType != InventoryDocumentType.Transfer)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.receive.type",
                    "Solo se recibe una transferencia.",
                    ErrorType.Conflict));
        }

        if (!transit.IsTransit)
        {
            return Result.Failure(
                new Error(
                    "warehousing.warehouse.transit.required",
                    "Falta la bodega de sistema En tránsito.",
                    ErrorType.Conflict));
        }

        var destOk = destination.EnsureOperational();
        if (destOk.IsFailure)
        {
            return destOk;
        }

        if (document.DestinationWarehouseId != destination.Id)
        {
            return Result.Failure(
                new Error(
                    "inventory.document.receive.destination",
                    "La bodega destino no coincide con el documento.",
                    ErrorType.Conflict));
        }

        var now = DateTimeOffset.UtcNow;
        var outPosted = await PostLinesAsync(
                document,
                transit.Id,
                InventoryMovementDirection.Out,
                items,
                receivedBy,
                now,
                ct)
            .ConfigureAwait(false);
        if (outPosted.IsFailure)
        {
            return outPosted;
        }

        var inPosted = await PostLinesAsync(
                document,
                destination.Id,
                InventoryMovementDirection.In,
                items,
                receivedBy,
                now,
                ct)
            .ConfigureAwait(false);
        if (inPosted.IsFailure)
        {
            return inPosted;
        }

        return document.MarkReceived(now, receivedBy);
    }

    private async Task<Result> PostLinesAsync(
        InventoryDocument document,
        Guid warehouseId,
        InventoryMovementDirection direction,
        IReadOnlyList<CatalogItem> items,
        Guid? actorId,
        DateTimeOffset occurredAt,
        CancellationToken ct)
    {
        var itemsById = items.ToDictionary(i => i.Id);
        var when = occurredAt;

        foreach (var line in document.Lines)
        {
            if (!itemsById.TryGetValue(line.CatalogItemId, out var item))
            {
                return Result.Failure(
                    new Error("catalog.item.not_found", "Uno o más ítems no existen.", ErrorType.NotFound));
            }

            var stockable = InventoryDocument.EnsureStockable(item);
            if (stockable.IsFailure)
            {
                return stockable;
            }

            var stock = await _stocks
                .GetTrackedAsync(document.TenantId, line.CatalogItemId, warehouseId, ct)
                .ConfigureAwait(false);
            if (stock is null)
            {
                var createdStock = Stock.Create(
                    _idGenerator.NewId(),
                    document.TenantId,
                    line.CatalogItemId,
                    warehouseId);
                if (createdStock.IsFailure)
                {
                    return Result.Failure(createdStock.Error!);
                }

                stock = createdStock.Value!;
                await _stocks.AddAsync(stock, ct).ConfigureAwait(false);
            }

            var applied = direction == InventoryMovementDirection.In
                ? stock.Increase(line.Quantity, actorId)
                : stock.Decrease(line.Quantity, actorId);
            if (applied.IsFailure)
            {
                return applied;
            }

            var movement = InventoryMovement.Create(
                _idGenerator.NewId(),
                document.TenantId,
                line.CatalogItemId,
                warehouseId,
                document.Id,
                direction,
                line.Quantity,
                when,
                actorId);
            if (movement.IsFailure)
            {
                return Result.Failure(movement.Error!);
            }

            await _movements.AddAsync(movement.Value!, ct).ConfigureAwait(false);
        }

        return Result.Success();
    }
}
