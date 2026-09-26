using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.GetCatalogItem;

public sealed class GetCatalogItemHandler : IQueryHandler<GetCatalogItemQuery, CatalogItemDetailResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IProductTemplateRepository _templates;

    public GetCatalogItemHandler(
        ICatalogItemRepository items,
        IProductTemplateRepository templates)
    {
        _items = items;
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

        var modelImages = item.Images
            .Where(i => i.GroupValue == null)
            .OrderBy(i => i.DisplayOrder)
            .ToList();

        var groupImages = item.Images
            .Where(i => i.GroupValue != null)
            .GroupBy(i => i.GroupValue!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(i => i.DisplayOrder).ToList(),
                StringComparer.OrdinalIgnoreCase);

        var groupThumbs = groupImages.ToDictionary(
            g => g.Key,
            g =>
            {
                var main = g.Value.FirstOrDefault(i => i.IsMain) ?? g.Value.FirstOrDefault();
                return main?.ThumbUrl ?? main?.MediumUrl ?? main?.LargeUrl;
            },
            StringComparer.OrdinalIgnoreCase);

        var axes = ParseMatrixAxes(item.VariantDimensionsJson);

        var variants = item.Variants
            .Where(v => v.DeletedAt == null)
            .Select(v =>
            {
                var ownImages = v.Images.OrderBy(i => i.DisplayOrder).ToList();
                var mainImg = ownImages.FirstOrDefault(i => i.IsMain) ?? ownImages.FirstOrDefault();
                var ownThumb = mainImg?.ThumbUrl ?? mainImg?.MediumUrl ?? mainImg?.LargeUrl;

                string? inheritedThumb = null;
                string? inheritedFrom = null;
                string? matchedGroupKey = null;
                if (ownThumb is null)
                {
                    foreach (var candidate in ResolveVariantGroupKeyCandidates(v, axes))
                    {
                        if (groupThumbs.TryGetValue(candidate, out var groupThumb) && groupThumb is not null)
                        {
                            inheritedThumb = groupThumb;
                            inheritedFrom = "group";
                            matchedGroupKey = candidate;
                            break;
                        }
                    }

                    if (inheritedThumb is null && modelThumb is not null)
                    {
                        inheritedThumb = modelThumb;
                        inheritedFrom = "model";
                    }
                }

                IReadOnlyList<CatalogItemImageResponse>? gallery;
                if (ownImages.Count > 0)
                {
                    gallery = ownImages.Select(CatalogItemImageResponse.FromEntity).ToList();
                }
                else if (matchedGroupKey is not null
                    && groupImages.TryGetValue(matchedGroupKey, out var groupGallery))
                {
                    gallery = groupGallery.Select(CatalogItemImageResponse.FromEntity).ToList();
                }
                else if (modelImages.Count > 0)
                {
                    gallery = modelImages.Select(CatalogItemImageResponse.FromEntity).ToList();
                }
                else
                {
                    gallery = null;
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
                    inheritedFrom,
                    ResolveVariantDimensionValues(v, axes),
                    gallery,
                    ResolveVariantStringList(v, "tags"),
                    ResolveVariantStringList(v, "colores_secundarios"));
            })
            .ToList();

        CatalogItem? parent = null;
        if (item.ParentId is { } parentId)
        {
            parent = await _items.GetActiveByIdAsync(query.TenantId, parentId, ct)
                .ConfigureAwait(false);
        }
        var parentName = parent?.Name;

        var matrixSource = item.IsMatrixParent ? item : parent;
        var matrixAxes = item.IsMatrixParent ? axes : ParseMatrixAxes(matrixSource?.VariantDimensionsJson);
        var matrixDescriptor = BuildMatrixDescriptor(matrixSource, matrixAxes);

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
                item.HierarchyPathJson,
                matrixDescriptor));
    }

    private static IReadOnlyList<MatrixAxisDef> ParseMatrixAxes(string? variantDimensionsJson)
    {
        if (string.IsNullOrWhiteSpace(variantDimensionsJson))
        {
            return Array.Empty<MatrixAxisDef>();
        }

        try
        {
            using var doc = JsonDocument.Parse(variantDimensionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<MatrixAxisDef>();
            }

            var axes = new List<MatrixAxisDef>();
            foreach (var dim in doc.RootElement.EnumerateArray())
            {
                if (dim.ValueKind != JsonValueKind.Object
                    || !dim.TryGetProperty("name", out var nameEl))
                {
                    continue;
                }

                var name = nameEl.GetString();
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var values = new List<string>();
                if (dim.TryGetProperty("values", out var valuesEl)
                    && valuesEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var valueEl in valuesEl.EnumerateArray())
                    {
                        if (valueEl.ValueKind == JsonValueKind.String)
                        {
                            var value = valueEl.GetString();
                            if (!string.IsNullOrWhiteSpace(value))
                            {
                                values.Add(value.Trim());
                            }
                        }
                    }
                }

                var photoGroup = dim.TryGetProperty("photoGroup", out var photoGroupEl)
                    && photoGroupEl.ValueKind == JsonValueKind.True;

                string? axisType = null;
                if (dim.TryGetProperty("type", out var typeEl) && typeEl.ValueKind == JsonValueKind.String)
                {
                    var candidate = typeEl.GetString()?.Trim().ToLowerInvariant();
                    if (candidate is "size" or "color" or "custom")
                    {
                        axisType = candidate;
                    }
                }

                axes.Add(new MatrixAxisDef(name.Trim(), values, photoGroup, axisType));
            }

            return axes;
        }
        catch (JsonException)
        {
            return Array.Empty<MatrixAxisDef>();
        }
    }

    private static CatalogMatrixDescriptorDto? BuildMatrixDescriptor(
        CatalogItem? matrixSource,
        IReadOnlyList<MatrixAxisDef> matrixAxes)
    {
        if (matrixSource is null || matrixAxes.Count == 0)
        {
            return null;
        }

        var groupValues = matrixSource.Images
            .Where(i => !string.IsNullOrWhiteSpace(i.GroupValue))
            .Select(i => i.GroupValue!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var descriptorAxes = matrixAxes
            .Select(a => new CatalogMatrixAxisDto(
                a.Name,
                a.Type ?? ResolveAxisType(a.Name),
                a.Values,
                a.PhotoGroup
                    || (groupValues.Count > 0
                        && a.Values.Any(v => groupValues.Contains(v, StringComparer.OrdinalIgnoreCase)))))
            .ToList();

        return new CatalogMatrixDescriptorDto(
            matrixAxes.Count,
            descriptorAxes,
            matrixAxes[0].Name,
            groupValues);
    }

    private static string ResolveAxisType(string name)
    {
        var normalized = name.Trim().ToLowerInvariant();
        if (normalized.Contains("color", StringComparison.Ordinal))
        {
            return "color";
        }

        if (normalized.Contains("talla", StringComparison.Ordinal)
            || normalized.Contains("size", StringComparison.Ordinal)
            || normalized.Contains("medida", StringComparison.Ordinal)
            || normalized.Contains("numero", StringComparison.Ordinal)
            || normalized.Contains("número", StringComparison.Ordinal))
        {
            return "size";
        }

        return "custom";
    }

    private static Dictionary<string, string>? ResolveVariantDimensionValues(
        CatalogItem variant,
        IReadOnlyList<MatrixAxisDef> axes)
    {
        if (axes.Count == 0 || string.IsNullOrWhiteSpace(variant.CustomAttributesJson))
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

            var properties = doc.RootElement.EnumerateObject().ToList();
            var dimensionValues = new Dictionary<string, string>();
            foreach (var axis in axes)
            {
                var match = properties.FirstOrDefault(p =>
                    string.Equals(p.Name, axis.Name, StringComparison.OrdinalIgnoreCase)
                    && p.Value.ValueKind == JsonValueKind.String);
                if (match.Value.ValueKind == JsonValueKind.String)
                {
                    dimensionValues[axis.Name] = match.Value.GetString()!;
                }
            }

            return dimensionValues.Count > 0 ? dimensionValues : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed record MatrixAxisDef(string Name, IReadOnlyList<string> Values, bool PhotoGroup, string? Type);

    /// <summary>
    /// Claves candidatas de grupo de fotos para una variante. Con ejes marcados <c>photoGroup</c>
    /// devuelve la clave compuesta (ej. "Alta|#457fc9"); sin flags (legado) prueba el valor de cada eje.
    /// </summary>
    private static IReadOnlyList<string> ResolveVariantGroupKeyCandidates(
        CatalogItem variant,
        IReadOnlyList<MatrixAxisDef> axes)
    {
        if (axes.Count == 0 || string.IsNullOrWhiteSpace(variant.CustomAttributesJson))
        {
            return Array.Empty<string>();
        }

        try
        {
            using var doc = JsonDocument.Parse(variant.CustomAttributesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Array.Empty<string>();
            }

            var properties = doc.RootElement.EnumerateObject().ToList();

            string? ValueOf(MatrixAxisDef axis)
            {
                var match = properties.FirstOrDefault(p =>
                    string.Equals(p.Name, axis.Name, StringComparison.OrdinalIgnoreCase)
                    && p.Value.ValueKind == JsonValueKind.String);
                return match.Value.ValueKind == JsonValueKind.String ? match.Value.GetString() : null;
            }

            var groupAxes = axes.Where(a => a.PhotoGroup).ToList();
            if (groupAxes.Count > 0)
            {
                var groupValues = groupAxes.Select(ValueOf).ToList();
                if (groupValues.All(v => !string.IsNullOrWhiteSpace(v)))
                {
                    return new[] { string.Join('|', groupValues.Select(v => v!.Trim())) };
                }

                return Array.Empty<string>();
            }

            return axes
                .Select(ValueOf)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v!.Trim())
                .ToList();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static List<string>? ResolveVariantStringList(CatalogItem variant, string key)
    {
        if (string.IsNullOrWhiteSpace(variant.CustomAttributesJson))
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

            JsonElement? found = null;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                {
                    found = prop.Value;
                    break;
                }
            }

            if (found is not { } element || element.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var values = element
                .EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String)
                .Select(e => e.GetString()!)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToList();

            return values.Count > 0 ? values : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
