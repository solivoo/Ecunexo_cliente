using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;

public sealed class AddCatalogItemVariantHandler
    : ICommandHandler<AddCatalogItemVariantCommand, AddCatalogItemVariantResponse>
{
    private readonly IValidator<AddCatalogItemVariantCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICatalogItemRepository _items;
    private readonly ICategoryRepository _categories;
    private readonly IStockRepository _stocks;
    private readonly IWarehouseRepository _warehouses;
    private readonly IUnitOfWork _unitOfWork;

    public AddCatalogItemVariantHandler(
        IValidator<AddCatalogItemVariantCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICatalogItemRepository items,
        ICategoryRepository categories,
        IStockRepository stocks,
        IWarehouseRepository warehouses,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _items = items;
        _categories = categories;
        _stocks = stocks;
        _warehouses = warehouses;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AddCatalogItemVariantResponse>> Handle(
        AddCatalogItemVariantCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.variant.add.validation", message, ErrorType.Validation));
        }

        var parent = await _items.GetTrackedByIdAsync(command.TenantId, command.ParentItemId, ct).ConfigureAwait(false);
        if (parent is null)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.item.parent_not_found", "El producto matriz no existe.", ErrorType.NotFound));
        }

        if (!parent.IsMatrixParent)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.item.not_matrix_parent", "El ítem seleccionado no es un producto matriz.", ErrorType.Validation));
        }

        var variantsAllowed = await CatalogTierLimits
            .EnsureVariantsWithinLimitAsync(_tenants, _items, command.TenantId, 1, ct)
            .ConfigureAwait(false);
        if (variantsAllowed.IsFailure)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(variantsAllowed.Error!);
        }

        if (await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.Sku, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<AddCatalogItemVariantResponse>(
                new Error("catalog.variant.sku.duplicate", $"El SKU '{command.Sku}' ya existe en el catálogo.", ErrorType.Conflict));
        }

        var schemaJson = CatalogAttributeSchema.EmptyArrayJson;
        if (parent.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(command.TenantId, categoryId, ct).ConfigureAwait(false);
            if (category is not null)
            {
                schemaJson = category.AttributeSchemaJson;
            }
        }

        var childId = _idGenerator.NewId();
        var childResult = CatalogItem.CreateVariantChild(
            childId,
            parent,
            command.VariantTitle,
            command.Sku,
            command.BasePrice,
            command.CustomAttributesJson,
            schemaJson);

        if (childResult.IsFailure)
        {
            return Result.Failure<AddCatalogItemVariantResponse>(childResult.Error!);
        }

        var child = childResult.Value!;
        await _items.AddAsync(child, ct).ConfigureAwait(false);

        if (command.InitialStock is decimal initialQty && initialQty > 0 && command.InitialStockWarehouseId is Guid warehouseId)
        {
            if (await _warehouses.GetActiveByIdAsync(command.TenantId, warehouseId, ct).ConfigureAwait(false) is not null)
            {
                var stockResult = Stock.Create(
                    _idGenerator.NewId(),
                    command.TenantId,
                    childId,
                    warehouseId);

                if (stockResult.IsSuccess)
                {
                    var stock = stockResult.Value!;
                    stock.Increase(initialQty, null);
                    await _stocks.AddAsync(stock, ct).ConfigureAwait(false);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new AddCatalogItemVariantResponse(
            child.Id,
            parent.Id,
            child.Sku ?? string.Empty,
            child.Name));
    }
}
