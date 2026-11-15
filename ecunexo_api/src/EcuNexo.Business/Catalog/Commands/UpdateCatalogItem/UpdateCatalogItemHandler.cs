using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;

public sealed class UpdateCatalogItemHandler : ICommandHandler<UpdateCatalogItemCommand, UpdateCatalogItemResponse>
{
    private readonly IValidator<UpdateCatalogItemCommand> _validator;
    private readonly ICatalogItemRepository _items;
    private readonly ISysSettingRepository _settings;
    private readonly IProductTemplateRepository _templates;
    private readonly ITenantRepository _tenants;
    private readonly IStockRepository _stocks;
    private readonly IInventoryMovementRepository _movements;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICategoryRepository? _categories;

    public UpdateCatalogItemHandler(
        IValidator<UpdateCatalogItemCommand> validator,
        ICatalogItemRepository items,
        ISysSettingRepository settings,
        IProductTemplateRepository templates,
        ITenantRepository tenants,
        IStockRepository stocks,
        IInventoryMovementRepository movements,
        IUnitOfWork unitOfWork,
        ICategoryRepository? categories = null)
    {
        _validator = validator;
        _items = items;
        _settings = settings;
        _templates = templates;
        _tenants = tenants;
        _stocks = stocks;
        _movements = movements;
        _unitOfWork = unitOfWork;
        _categories = categories;
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
        string? categoryName = null;
        if (command.CategoryId is { } categoryId)
        {
            if (_categories is null)
            {
                return Result.Failure<UpdateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            var category = await _categories
                .GetActiveByIdAsync(command.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            if (category is null)
            {
                return Result.Failure<UpdateCatalogItemResponse>(
                    new Error("catalog.item.category.not_found", "La categoría no existe.", ErrorType.NotFound));
            }

            categoryName = category.Name;
        }

        string? familyHierarchyJson = null;
        if (command.FamilyId is { } familyId)
        {
            var family = await _templates.GetByIdAsync(familyId, command.TenantId, ct).ConfigureAwait(false);
            if (family is null)
            {
                return Result.Failure<UpdateCatalogItemResponse>(
                    new Error("catalog.item.family.not_found", "El arquetipo (familia) no existe.", ErrorType.NotFound));
            }

            familyHierarchyJson = family.HierarchyTreeJson;
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

        if (!string.IsNullOrWhiteSpace(command.Barcode)
            && await _items.BarcodeExistsIgnoreCaseAsync(command.TenantId, command.Barcode, item.Id, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<UpdateCatalogItemResponse>(
                new Error("catalog.item.barcode.duplicate", "Ya existe un ítem con el mismo código de barras.", ErrorType.Conflict));
        }

        var syncedHierarchyPathJson = CatalogItem.SyncCategoryInHierarchyPath(
            command.HierarchyPathJson,
            categoryName);

        var previousParentKeys = item.IsMatrixParent
            ? ExtractKeysForParentSync(item.CustomAttributesJson, item.HierarchyPathJson, familyHierarchyJson)
            : [];

        var updated = item.Update(
            command.Name,
            command.Description,
            command.Sku,
            command.BasePrice,
            command.CustomAttributesJson,
            schemaJson,
            updatedBy: null,
            familyId: command.FamilyId,
            hierarchyPathJson: syncedHierarchyPathJson,
            minOrderQuantity: command.MinOrderQuantity,
            costPrice: command.CostPrice,
            categoryId: command.CategoryId);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateCatalogItemResponse>(updated.Error!);
        }

        var barcodeResult = item.SetBarcode(command.Barcode);
        if (barcodeResult.IsFailure)
        {
            return Result.Failure<UpdateCatalogItemResponse>(barcodeResult.Error!);
        }

        // Si se edita el padre matriz, propagar clasificación y atributos de modelo a sus variantes vivas.
        if (item.IsMatrixParent && item.Variants.Count > 0)
        {
            var keysToSync = new HashSet<string>(previousParentKeys, StringComparer.OrdinalIgnoreCase);
            foreach (var k in ExtractKeysForParentSync(item.CustomAttributesJson, item.HierarchyPathJson, familyHierarchyJson))
            {
                keysToSync.Add(k);
            }

            foreach (var variant in item.Variants.Where(v => v.DeletedAt is null))
            {
                variant.SyncSharedModelFromParent(item, keysToSync);
            }
        }

        // Si se edita una variante, recalcular ejes disponibles del padre y sincronizar nombre si es la primera.
        if (item.ParentId is { } parentId)
        {
            var parent = item.Parent
                ?? await _items.GetTrackedByIdAsync(command.TenantId, parentId, ct).ConfigureAwait(false);
            if (parent is not null)
            {
                if (item.SortOrder == 0)
                {
                    var variantName = CatalogVariantNameResolver.ResolveFromAttributes(item.CustomAttributesJson)
                        ?? item.Name;
                    if (!string.IsNullOrWhiteSpace(variantName))
                    {
                        var renamed = parent.Rename(variantName);
                        if (renamed.IsFailure)
                        {
                            return Result.Failure<UpdateCatalogItemResponse>(renamed.Error!);
                        }
                    }
                }

                var liveVariants = parent.Variants
                    .Where(v => v.DeletedAt is null)
                    .ToList();
                if (liveVariants.All(v => v.Id != item.Id))
                {
                    liveVariants.Add(item);
                }

                parent.RebuildVariantDimensionsFromVariants(liveVariants);
            }
        }

        if (command.Status is { } status)
        {
            if (status == CatalogItemStatus.Active
                && item.Status != CatalogItemStatus.Active
                && item.ParentId.HasValue)
            {
                var activeAllowed = await CatalogTierLimits
                    .EnsureActiveVariantsWithinLimitAsync(_tenants, _items, command.TenantId, 1, ct)
                    .ConfigureAwait(false);
                if (activeAllowed.IsFailure)
                {
                    return Result.Failure<UpdateCatalogItemResponse>(activeAllowed.Error!);
                }
            }

            var statusResult = item.SetStatus(status, updatedBy: null);
            if (statusResult.IsFailure)
            {
                return Result.Failure<UpdateCatalogItemResponse>(statusResult.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateCatalogItemResponse(item.Id, item.TenantId));
    }

    private static HashSet<string> ExtractKeysForParentSync(
        string? customAttributesJson,
        string? hierarchyPathJson,
        string? familyTreeJson)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(customAttributesJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(customAttributesJson);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        if (!string.IsNullOrWhiteSpace(prop.Name))
                        {
                            keys.Add(prop.Name.Trim());
                        }
                    }
                }
            }
            catch (JsonException)
            {
                // ignorar
            }
        }

        if (!string.IsNullOrWhiteSpace(hierarchyPathJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(hierarchyPathJson);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in doc.RootElement.EnumerateArray())
                    {
                        if (el.ValueKind == JsonValueKind.Object
                            && el.TryGetProperty("name", out var nEl)
                            && nEl.ValueKind == JsonValueKind.String)
                        {
                            var name = nEl.GetString()?.Trim();
                            if (!string.IsNullOrEmpty(name))
                            {
                                keys.Add(name);
                            }
                        }
                    }
                }
            }
            catch (JsonException)
            {
                // ignorar
            }
        }

        if (!string.IsNullOrWhiteSpace(familyTreeJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(familyTreeJson);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var levels = doc.RootElement.EnumerateArray().ToList();
                    var hasAxes = levels.Any(lvl =>
                        lvl.ValueKind == JsonValueKind.Object
                        && lvl.TryGetProperty("axes", out var axesEl)
                        && axesEl.ValueKind == JsonValueKind.Array
                        && axesEl.GetArrayLength() > 0);

                    for (var i = 0; i < levels.Count; i++)
                    {
                        // Si la plantilla tiene ejes en el nivel final, sus atributos pertenecen al SKU, no al padre.
                        if (hasAxes && i == levels.Count - 1)
                        {
                            continue;
                        }

                        var lvl = levels[i];
                        if (lvl.ValueKind == JsonValueKind.Object
                            && lvl.TryGetProperty("attributes", out var attrsEl)
                            && attrsEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var attr in attrsEl.EnumerateArray())
                            {
                                var name = attr.GetString()?.Trim();
                                if (!string.IsNullOrEmpty(name))
                                {
                                    keys.Add(name);
                                }
                            }
                        }
                    }
                }
            }
            catch (JsonException)
            {
                // ignorar
            }
        }

        return keys;
    }
}
