using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.GetCatalogItem;

public sealed class GetCatalogItemHandler : IQueryHandler<GetCatalogItemQuery, CatalogItemDetailResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly ICategoryRepository _categories;
    private readonly IProductTemplateRepository _templates;

    public GetCatalogItemHandler(
        ICatalogItemRepository items,
        ICategoryRepository categories,
        IProductTemplateRepository templates)
    {
        _items = items;
        _categories = categories;
        _templates = templates;
    }

    public async Task<Result<CatalogItemDetailResponse>> Handle(
        GetCatalogItemQuery query,
        CancellationToken ct)
    {
        var item = await _items.GetActiveByIdAsync(query.TenantId, query.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<CatalogItemDetailResponse>(
                new Error("catalog.item.not_found", "El ítem no existe.", ErrorType.NotFound));
        }

        string? categoryName = null;
        if (item.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(query.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            categoryName = category?.Name;
        }

        var images = item.Images
            .OrderBy(i => i.DisplayOrder)
            .Select(CatalogItemImageResponse.FromEntity)
            .ToList();

        // Herencia de imagen: la variante sin foto propia usa la del grupo (si coincide) o la del modelo.
        var modelMainImage = item.Images
            .Where(i => i.GroupValue == null)
            .OrderBy(i => i.DisplayOrder)
            .FirstOrDefault(i => i.IsMain)
            ?? item.Images.Where(i => i.GroupValue == null).OrderBy(i => i.DisplayOrder).FirstOrDefault();
        var modelThumb = modelMainImage?.ThumbUrl ?? modelMainImage?.MediumUrl ?? modelMainImage?.LargeUrl;

        var groupThumbs = item.Images
            .Where(i => i.GroupValue != null)
            .GroupBy(i => i.GroupValue!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var ordered = g.OrderBy(i => i.DisplayOrder).ToList();
                    var main = ordered.FirstOrDefault(i => i.IsMain) ?? ordered.FirstOrDefault();
                    return main?.ThumbUrl ?? main?.MediumUrl ?? main?.LargeUrl;
                },
                StringComparer.OrdinalIgnoreCase);

        var primaryDimensionName = ResolvePrimaryDimensionName(item.VariantDimensionsJson);

        var variants = item.Variants
            .Where(v => v.DeletedAt == null)
            .Select(v =>
            {
                var mainImg = v.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault(i => i.IsMain)
                    ?? v.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault();
                var ownThumb = mainImg?.ThumbUrl ?? mainImg?.MediumUrl ?? mainImg?.LargeUrl;

                string? inheritedThumb = null;
                string? inheritedFrom = null;
                if (ownThumb is null)
                {
                    var groupValue = ResolveVariantGroupValue(v, primaryDimensionName);
                    if (groupValue is not null
                        && groupThumbs.TryGetValue(groupValue, out var groupThumb)
                        && groupThumb is not null)
                    {
                        inheritedThumb = groupThumb;
                        inheritedFrom = "group";
                    }
                    else if (modelThumb is not null)
                    {
                        inheritedThumb = modelThumb;
                        inheritedFrom = "model";
                    }
                }

                return new CatalogItemVariantDto(
                    v.Id,
                    v.Name,
                    v.Sku,
                    v.BasePrice,
                    v.CustomAttributesJson,
                    v.Status,
                    ownThumb ?? inheritedThumb,
                    inheritedFrom is not null,
                    inheritedFrom);
            })
            .ToList();

        string? parentName = null;
        if (item.ParentId is { } parentId)
        {
            var parent = await _items.GetActiveByIdAsync(query.TenantId, parentId, ct)
                .ConfigureAwait(false);
            parentName = parent?.Name;
        }

        string? familyName = null;
        if (item.FamilyId is { } familyId)
        {
            var family = await _templates.GetByIdAsync(familyId, query.TenantId, ct).ConfigureAwait(false);
            familyName = family?.Name;
        }

        return Result.Success(
            new CatalogItemDetailResponse(
                item.Id,
                item.Kind,
                item.Name,
                item.Description,
                item.Sku,
                item.BasePrice,
                item.CategoryId,
                categoryName,
                item.CustomAttributesJson,
                item.Status,
                item.CreatedAt,
                item.UpdatedAt,
                images,
                item.IsMatrixParent,
                item.ParentId,
                item.VariantDimensionsJson,
                variants.Count > 0 ? variants : null,
                parentName,
                item.FamilyId,
                familyName,
                item.HierarchyPathJson));
    }

    private static string? ResolvePrimaryDimensionName(string? variantDimensionsJson)
    {
        if (string.IsNullOrWhiteSpace(variantDimensionsJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(variantDimensionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            foreach (var dim in doc.RootElement.EnumerateArray())
            {
                if (dim.ValueKind == JsonValueKind.Object
                    && dim.TryGetProperty("name", out var nameEl))
                {
                    return nameEl.GetString();
                }
            }
        }
        catch (JsonException)
        {
            // Dimensiones inválidas: sin herencia por grupo
        }

        return null;
    }

    private static string? ResolveVariantGroupValue(CatalogItem variant, string? primaryDimensionName)
    {
        if (string.IsNullOrWhiteSpace(primaryDimensionName))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(variant.CustomAttributesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (string.Equals(prop.Name, primaryDimensionName, StringComparison.OrdinalIgnoreCase)
                    && prop.Value.ValueKind == JsonValueKind.String)
                {
                    return prop.Value.GetString();
                }
            }
        }
        catch (JsonException)
        {
            // Atributos inválidos: sin herencia por grupo
        }

        return null;
    }
}
