using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;

public sealed class CreateCatalogItemMatrixHandler
    : ICommandHandler<CreateCatalogItemMatrixCommand, CreateCatalogItemMatrixResponse>
{
    private readonly IValidator<CreateCatalogItemMatrixCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICategoryRepository _categories;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IStockRepository _stocks;
    private readonly IWarehouseRepository _warehouses;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCatalogItemMatrixHandler(
        IValidator<CreateCatalogItemMatrixCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICategoryRepository categories,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IStockRepository stocks,
        IWarehouseRepository warehouses,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _categories = categories;
        _items = items;
        _settings = settings;
        _stocks = stocks;
        _warehouses = warehouses;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateCatalogItemMatrixResponse>> Handle(
        CreateCatalogItemMatrixCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateCatalogItemMatrixResponse>(
                new Error("catalog.matrix.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(
                new Error("catalog.matrix.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var kindAllowed = await AllowedCatalogItemKinds
            .EnsureAllowedAsync(_settings, command.TenantId, command.Kind, ct)
            .ConfigureAwait(false);
        if (kindAllowed.IsFailure)
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(kindAllowed.Error!);
        }

        var schemaJson = CatalogAttributeSchema.EmptyArrayJson;
        if (command.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            schemaJson = category.AttributeSchemaJson;
        }

        // Validar unicidad de SKUs en el payload entre sí
        var seenPayloadSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var v in command.Variants)
        {
            if (!seenPayloadSkus.Add(v.Sku.Trim()))
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.sku.duplicate_in_payload", $"El SKU '{v.Sku}' está repetido en la lista de variantes.", ErrorType.Validation));
            }

            if (await _items.SkuExistsIgnoreCaseAsync(command.TenantId, v.Sku, null, ct).ConfigureAwait(false))
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.sku.duplicate_in_db", $"El SKU '{v.Sku}' ya existe en el catálogo.", ErrorType.Conflict));
            }
        }

        if (!string.IsNullOrWhiteSpace(command.ModelCode)
            && await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.ModelCode, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(
                new Error("catalog.matrix.model_code.duplicate", $"El código de modelo '{command.ModelCode}' ya existe como SKU en el catálogo.", ErrorType.Conflict));
        }

        var parentId = _idGenerator.NewId();
        var parentResult = CatalogItem.CreateMatrixParent(
            parentId,
            command.TenantId,
            command.Kind,
            command.Name,
            command.Description,
            command.ModelCode,
            command.BasePrice,
            command.CategoryId,
            command.VariantDimensionsJson,
            command.CustomAttributesJson,
            schemaJson);

        if (parentResult.IsFailure)
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(parentResult.Error!);
        }

        var parent = parentResult.Value!;
        await _items.AddAsync(parent, ct).ConfigureAwait(false);

        var variantIds = new List<Guid>();

        foreach (var v in command.Variants)
        {
            var childId = _idGenerator.NewId();
            var childResult = CatalogItem.CreateVariantChild(
                childId,
                parent,
                v.VariantTitle,
                v.Sku,
                v.BasePrice,
                v.CustomAttributesJson,
                schemaJson);

            if (childResult.IsFailure)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(childResult.Error!);
            }

            var child = childResult.Value!;
            await _items.AddAsync(child, ct).ConfigureAwait(false);
            variantIds.Add(childId);

            // Inicializar saldo en bodega si se indicó
            if (v.InitialStock is decimal initialQty && initialQty > 0 && v.InitialStockWarehouseId is Guid warehouseId)
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
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateCatalogItemMatrixResponse(
            parent.Id,
            variantIds.Count,
            variantIds));
    }
}
