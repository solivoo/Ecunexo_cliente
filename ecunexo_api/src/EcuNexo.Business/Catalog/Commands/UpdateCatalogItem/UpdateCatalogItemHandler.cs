using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;

public sealed class UpdateCatalogItemHandler : ICommandHandler<UpdateCatalogItemCommand, UpdateCatalogItemResponse>
{
    private readonly IValidator<UpdateCatalogItemCommand> _validator;
    private readonly ICategoryRepository _categories;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IStockRepository _stocks;
    private readonly IInventoryMovementRepository _movements;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCatalogItemHandler(
        IValidator<UpdateCatalogItemCommand> validator,
        ICategoryRepository categories,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IStockRepository stocks,
        IInventoryMovementRepository movements,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _categories = categories;
        _items = items;
        _settings = settings;
        _stocks = stocks;
        _movements = movements;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateCatalogItemResponse>> Handle(
        UpdateCatalogItemCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateCatalogItemResponse>(
                new Error("catalog.item.update.validation", message, ErrorType.Validation));
        }

        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<UpdateCatalogItemResponse>(
                new Error("catalog.item.not_found", "El ítem no existe.", ErrorType.NotFound));
        }

        var schemaJson = CatalogAttributeSchema.EmptyArrayJson;
        if (command.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<UpdateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            schemaJson = category.AttributeSchemaJson;
        }

        if (!string.IsNullOrWhiteSpace(command.Sku)
            && await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.Sku, command.ItemId, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<UpdateCatalogItemResponse>(
                new Error("catalog.item.sku.duplicate", "Ya existe un ítem con el mismo SKU.", ErrorType.Conflict));
        }

        if (command.Kind is { } newKind && newKind != item.Kind)
        {
            var kindAllowed = await AllowedCatalogItemKinds
                .EnsureAllowedAsync(_settings, command.TenantId, newKind, ct)
                .ConfigureAwait(false);
            if (kindAllowed.IsFailure)
            {
                return Result.Failure<UpdateCatalogItemResponse>(kindAllowed.Error!);
            }

            if (item.Kind == CatalogItemKind.Physical && newKind == CatalogItemKind.Service)
            {
                var hasStock = await _stocks
                    .ExistsForItemAsync(command.TenantId, command.ItemId, ct)
                    .ConfigureAwait(false);
                var hasMoves = await _movements
                    .ExistsForItemAsync(command.TenantId, command.ItemId, ct)
                    .ConfigureAwait(false);
                if (hasStock || hasMoves)
                {
                    return Result.Failure<UpdateCatalogItemResponse>(
                        new Error(
                            "catalog.item.kind.physical_locked",
                            "Este físico ya tiene stock o movimientos. No se puede pasar a servicio.",
                            ErrorType.Conflict));
                }
            }

            var kindChanged = item.ChangeKind(newKind, command.Sku, updatedBy: null);
            if (kindChanged.IsFailure)
            {
                return Result.Failure<UpdateCatalogItemResponse>(kindChanged.Error!);
            }
        }

        var updated = item.Update(
            command.Name,
            command.Description,
            command.Sku,
            command.BasePrice,
            command.CategoryId,
            command.CustomAttributesJson,
            schemaJson,
            updatedBy: null);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateCatalogItemResponse>(updated.Error!);
        }

        if (command.Status is { } status)
        {
            var statusResult = item.SetStatus(status, updatedBy: null);
            if (statusResult.IsFailure)
            {
                return Result.Failure<UpdateCatalogItemResponse>(statusResult.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateCatalogItemResponse(item.Id, item.TenantId));
    }
}
