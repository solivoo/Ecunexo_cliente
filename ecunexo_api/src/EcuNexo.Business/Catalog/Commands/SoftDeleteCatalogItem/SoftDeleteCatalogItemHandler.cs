using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.SoftDeleteCatalogItem;

public sealed class SoftDeleteCatalogItemHandler
    : ICommandHandler<SoftDeleteCatalogItemCommand, SoftDeleteCatalogItemResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IStockRepository _stocks;
    private readonly IInventoryMovementRepository _movements;
    private readonly IInventoryDocumentRepository _documents;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICallerContext _caller;

    public SoftDeleteCatalogItemHandler(
        ICatalogItemRepository items,
        IStockRepository stocks,
        IInventoryMovementRepository movements,
        IInventoryDocumentRepository documents,
        IUnitOfWork unitOfWork,
        ICallerContext caller)
    {
        _items = items;
        _stocks = stocks;
        _movements = movements;
        _documents = documents;
        _unitOfWork = unitOfWork;
        _caller = caller;
    }

    public async Task<Result<SoftDeleteCatalogItemResponse>> Handle(
        SoftDeleteCatalogItemCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty || command.ItemId == Guid.Empty)
        {
            return Result.Failure<SoftDeleteCatalogItemResponse>(
                new Error(
                    "catalog.item.delete.validation",
                    "Tenant e ítem son obligatorios.",
                    ErrorType.Validation));
        }

        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct)
            .ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<SoftDeleteCatalogItemResponse>(
                new Error("catalog.item.not_found", "El ítem no existe.", ErrorType.NotFound));
        }

        var hasStock = await _stocks
            .ExistsForItemAsync(command.TenantId, command.ItemId, ct)
            .ConfigureAwait(false);
        var hasMoves = await _movements
            .ExistsForItemAsync(command.TenantId, command.ItemId, ct)
            .ConfigureAwait(false);
        var hasDocuments = await _documents
            .ExistsForItemAsync(command.TenantId, command.ItemId, ct)
            .ConfigureAwait(false);

        if (hasStock || hasMoves || hasDocuments)
        {
            var reasons = new List<string>();
            if (hasStock)
            {
                reasons.Add("stock");
            }

            if (hasMoves)
            {
                reasons.Add("movimientos de inventario");
            }

            if (hasDocuments)
            {
                reasons.Add("documentos de inventario");
            }

            return Result.Failure<SoftDeleteCatalogItemResponse>(
                new Error(
                    "catalog.item.delete.in_use",
                    $"No se puede eliminar: el ítem tiene {string.Join(", ", reasons)}. "
                    + "Desactívalo (estado Inactivo) o modifica el ítem; no borres historial asociado.",
                    ErrorType.Conflict));
        }

        var deleted = item.SoftDelete(DateTimeOffset.UtcNow, _caller.UserId);
        if (deleted.IsFailure)
        {
            return Result.Failure<SoftDeleteCatalogItemResponse>(deleted.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SoftDeleteCatalogItemResponse(item.Id, item.TenantId));
    }
}
