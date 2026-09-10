using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;

public sealed class CreateInventoryDocumentHandler
    : ICommandHandler<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse>
{
    private readonly IValidator<CreateInventoryDocumentCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly ICatalogItemRepository _items;
    private readonly IInventoryDocumentRepository _documents;
    private readonly IUnitOfWork _unitOfWork;

    public CreateInventoryDocumentHandler(
        IValidator<CreateInventoryDocumentCommand> validator,
        IIdGenerator idGenerator,
        IWarehouseRepository warehouses,
        DefaultWarehouseProvisioner warehouseProvisioner,
        ICatalogItemRepository items,
        IInventoryDocumentRepository documents,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _warehouses = warehouses;
        _warehouseProvisioner = warehouseProvisioner;
        _items = items;
        _documents = documents;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateInventoryDocumentResponse>> Handle(
        CreateInventoryDocumentCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateInventoryDocumentResponse>(
                new Error("inventory.document.create.validation", message, ErrorType.Validation));
        }

        if (command.DocumentType == InventoryDocumentType.Transfer)
        {
            await _warehouseProvisioner.EnsureAsync(command.TenantId, ct).ConfigureAwait(false);
        }

        var warehouse = await _warehouses.GetActiveByIdAsync(command.TenantId, command.WarehouseId, ct)
            .ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<CreateInventoryDocumentResponse>(
                new Error("warehousing.warehouse.not_found", "La bodega no existe.", ErrorType.NotFound));
        }

        var operational = warehouse.EnsureOperational();
        if (operational.IsFailure)
        {
            return Result.Failure<CreateInventoryDocumentResponse>(operational.Error!);
        }

        if (command.DocumentType == InventoryDocumentType.Transfer)
        {
            var destination = await _warehouses
                .GetActiveByIdAsync(command.TenantId, command.DestinationWarehouseId!.Value, ct)
                .ConfigureAwait(false);
            if (destination is null)
            {
                return Result.Failure<CreateInventoryDocumentResponse>(
                    new Error(
                        "warehousing.warehouse.destination.not_found",
                        "La bodega destino no existe.",
                        ErrorType.NotFound));
            }

            var destOk = destination.EnsureOperational();
            if (destOk.IsFailure)
            {
                return Result.Failure<CreateInventoryDocumentResponse>(destOk.Error!);
            }
        }

        var itemIds = command.Lines.Select(l => l.CatalogItemId).Distinct().ToList();
        var catalogItems = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);
        if (catalogItems.Count != itemIds.Count)
        {
            return Result.Failure<CreateInventoryDocumentResponse>(
                new Error("catalog.item.not_found", "Uno o más ítems no existen.", ErrorType.NotFound));
        }

        foreach (var item in catalogItems)
        {
            var stockable = InventoryDocument.EnsureStockable(item);
            if (stockable.IsFailure)
            {
                return Result.Failure<CreateInventoryDocumentResponse>(stockable.Error!);
            }

            if (item.Status != Core.Catalog.CatalogItemStatus.Active)
            {
                return Result.Failure<CreateInventoryDocumentResponse>(
                    new Error(
                        "catalog.item.inactive",
                        $"El ítem «{item.Name}» está inactivo y no puede utilizarse en nuevos documentos de inventario.",
                        ErrorType.Conflict));
            }
        }

        var lineInputs = command.Lines
            .Select(l => (_idGenerator.NewId(), l.CatalogItemId, l.Quantity))
            .ToList();
        var created = InventoryDocument.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.DocumentType,
            command.WarehouseId,
            command.Notes,
            lineInputs,
            command.DestinationWarehouseId,
            command.ReceiptOrigin,
            command.SourceDocumentNumber);
        if (created.IsFailure)
        {
            return Result.Failure<CreateInventoryDocumentResponse>(created.Error!);
        }

        var document = created.Value!;
        await _documents.AddAsync(document, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new CreateInventoryDocumentResponse(document.Id, document.TenantId, document.Status));
    }
}
