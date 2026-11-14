using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;

public sealed class CreateCatalogItemMatrixHandler
    : ICommandHandler<CreateCatalogItemMatrixCommand, CreateCatalogItemMatrixResponse>
{
    private readonly IValidator<CreateCatalogItemMatrixCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IProductTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICategoryRepository? _categories;

    public CreateCatalogItemMatrixHandler(
        IValidator<CreateCatalogItemMatrixCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IProductTemplateRepository templates,
        IUnitOfWork unitOfWork,
        ICategoryRepository? categories = null)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _items = items;
        _settings = settings;
        _templates = templates;
        _unitOfWork = unitOfWork;
        _categories = categories;
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
        string? categoryName = null;
        if (command.CategoryId is { } categoryId)
        {
            if (_categories is null)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            var category = await _categories
                .GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            categoryName = category.Name;
        }

        string? familyName = null;
        if (command.FamilyId is { } familyId)
        {
            var family = await _templates.GetByIdAsync(familyId, command.TenantId, ct).ConfigureAwait(false);
            if (family is null)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(
                    new Error("catalog.matrix.family.not_found", "El arquetipo (familia) no existe.", ErrorType.NotFound));
            }

            familyName = family.Name;
        }

        var variantsAllowed = await CatalogTierLimits
            .EnsureVariantsWithinLimitAsync(_tenants, _items, command.TenantId, command.Variants.Count, ct)
            .ConfigureAwait(false);
        if (variantsAllowed.IsFailure)
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(variantsAllowed.Error!);
        }

        // Validar unicidad de SKUs en el payload entre sí
        var seenPayloadSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenPayloadBarcodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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

            if (!string.IsNullOrWhiteSpace(v.Barcode))
            {
                if (!seenPayloadBarcodes.Add(v.Barcode.Trim()))
                {
                    return Result.Failure<CreateCatalogItemMatrixResponse>(
                        new Error("catalog.matrix.barcode.duplicate_in_payload", $"El código de barras '{v.Barcode}' está repetido en la lista de variantes.", ErrorType.Validation));
                }

                if (await _items.BarcodeExistsIgnoreCaseAsync(command.TenantId, v.Barcode, null, ct).ConfigureAwait(false))
                {
                    return Result.Failure<CreateCatalogItemMatrixResponse>(
                        new Error("catalog.matrix.barcode.duplicate_in_db", $"El código de barras '{v.Barcode}' ya existe en el catálogo.", ErrorType.Conflict));
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(command.ModelCode)
            && await _items.SkuExistsIgnoreCaseAsync(command.TenantId, command.ModelCode, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(
                new Error("catalog.matrix.model_code.duplicate", $"El código de modelo '{command.ModelCode}' ya existe como SKU en el catálogo.", ErrorType.Conflict));
        }

        var syncedHierarchyPathJson = CatalogItem.SyncCategoryInHierarchyPath(
            command.HierarchyPathJson,
            categoryName);

        // Matriz: identidad útil = UUID (Id). ModelCode/Sku del padre quedan null.
        // Name es metadata interna (plantilla / primera variante / "Matriz"); no se usa como código.
        var resolvedParentName = ResolveMatrixParentName(command.Name, familyName, command.Variants);

        var parentId = _idGenerator.NewId();
        var parentResult = CatalogItem.CreateMatrixParent(
            parentId,
            command.TenantId,
            command.Kind,
            resolvedParentName,
            command.Description,
            modelCode: null,
            command.BasePrice,
            command.VariantDimensionsJson,
            command.CustomAttributesJson,
            schemaJson,
            familyId: command.FamilyId,
            hierarchyPathJson: syncedHierarchyPathJson,
            costPrice: command.CostPrice,
            minOrderQuantity: command.MinOrderQuantity,
            categoryId: command.CategoryId);

        if (parentResult.IsFailure)
        {
            return Result.Failure<CreateCatalogItemMatrixResponse>(parentResult.Error!);
        }

        var parent = parentResult.Value!;

        await _items.AddAsync(parent, ct).ConfigureAwait(false);

        var variantIds = new List<Guid>();
        var sortOrder = 0;

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
                schemaJson,
                barcode: v.Barcode,
                costPrice: v.CostPrice);

            if (childResult.IsFailure)
            {
                return Result.Failure<CreateCatalogItemMatrixResponse>(childResult.Error!);
            }

            var child = childResult.Value!;
            child.SetSortOrder(sortOrder);
            sortOrder++;
            parent.AddVariantChild(child);
            await _items.AddAsync(child, ct).ConfigureAwait(false);
            variantIds.Add(childId);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateCatalogItemMatrixResponse(
            parent.Id,
            variantIds.Count,
            variantIds));
    }

    private static string ResolveMatrixParentName(
        string? requestedName,
        string? familyName,
        IReadOnlyList<CreateVariantChildDto> variants)
    {
        // La familia es solo un UUID interno (family_id); su nombre de plantilla
        // nunca debe convertirse en el nombre comercial del producto.
        static bool IsWeakName(string? value, string? family) =>
            string.IsNullOrWhiteSpace(value)
            || value.Trim().Equals("Producto", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("Matriz", StringComparison.OrdinalIgnoreCase)
            || (!string.IsNullOrWhiteSpace(family)
                && value.Trim().Equals(family.Trim(), StringComparison.OrdinalIgnoreCase));

        var firstVariantName = variants
            .Select(v => CatalogVariantNameResolver.ResolveFromAttributes(v.CustomAttributesJson))
            .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name));
        if (!string.IsNullOrWhiteSpace(firstVariantName))
        {
            return firstVariantName!;
        }

        var firstTitle = variants
            .Select(v => v.VariantTitle)
            .FirstOrDefault(title => !string.IsNullOrWhiteSpace(title));
        if (!string.IsNullOrWhiteSpace(firstTitle))
        {
            return firstTitle!;
        }

        if (!IsWeakName(requestedName, familyName))
        {
            return requestedName!.Trim();
        }

        return "Matriz";
    }
}
