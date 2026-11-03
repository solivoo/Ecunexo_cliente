using System.Text.Json;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Resolución determinística y bidireccional de la imagen representativa (miniatura y mediana)
/// para productos matriz padres, variantes hijas e ítems simples en todos los modos de fotografía
/// (<c>model</c>, <c>group</c> mono-eje o multi-eje compuesto con <c>|</c>, y <c>variant</c>).
/// </summary>
public static class CatalogItemThumbnailResolver
{
    public sealed record MatrixAxisSpec(
        string Name,
        IReadOnlyList<string> Values,
        bool PhotoGroup,
        string? Type);

    /// <summary>
    /// Resuelve la imagen representativa para un producto matriz padre o ítem independiente.
    /// Orden de prioridad en matriz:
    /// 1) Foto general del modelo (<c>GroupValue == null</c>).
    /// 2) Primera foto de grupo según el orden de valores declarados en los ejes de la matriz.
    /// 3) Foto principal de la primera variante activa (por <c>SortOrder</c> y <c>CreatedAt</c>) que tenga imágenes.
    /// </summary>
    public static CatalogItemImage? ResolveParentOrStandaloneImage(
        CatalogItem item,
        IEnumerable<CatalogItem>? activeVariants = null)
    {
        ArgumentNullException.ThrowIfNull(item);

        if (!item.IsMatrixParent)
        {
            return PickBestImage(item.Images);
        }

        // 1. Foto general del modelo (sin grupo)
        var modelImages = item.Images
            .Where(i => string.IsNullOrWhiteSpace(i.GroupValue))
            .ToList();
        if (modelImages.Count > 0)
        {
            return PickBestImage(modelImages);
        }

        // 2. Foto por grupo (siguiendo el orden de valores de los ejes configurados en la matriz)
        var groupedImages = item.Images
            .Where(i => !string.IsNullOrWhiteSpace(i.GroupValue))
            .ToList();
        if (groupedImages.Count > 0)
        {
            var byNormalizedGroup = groupedImages
                .GroupBy(i => NormalizeGroupKey(i.GroupValue!), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => PickBestImage(g)!, StringComparer.OrdinalIgnoreCase);

            var axes = ParseMatrixAxes(item.VariantDimensionsJson);
            var groupAxes = axes.Where(a => a.PhotoGroup && a.Values.Count > 0).ToList();

            if (groupAxes.Count > 0)
            {
                var expandedAxisSets = groupAxes
                    .Select(a => (IReadOnlyList<string>)a.Values.SelectMany(ExpandAxisValueCandidates).Distinct(StringComparer.OrdinalIgnoreCase).ToList())
                    .ToList();

                foreach (var compositeKey in BuildCartesianGroupKeys(expandedAxisSets))
                {
                    if (byNormalizedGroup.TryGetValue(NormalizeGroupKey(compositeKey), out var matched))
                    {
                        return matched;
                    }
                }
            }

            foreach (var axis in axes)
            {
                foreach (var val in axis.Values.SelectMany(ExpandAxisValueCandidates))
                {
                    if (byNormalizedGroup.TryGetValue(NormalizeGroupKey(val), out var matched))
                    {
                        return matched;
                    }
                }
            }

            return PickBestImage(groupedImages);
        }

        // 3. Foto de la primera variante activa con imagen propia (modo photoChoice = 'variant')
        var variantsSource = activeVariants ?? item.Variants;
        var orderedVariants = variantsSource
            .Where(v => v.DeletedAt == null)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.CreatedAt);

        foreach (var variant in orderedVariants)
        {
            if (variant.Images.Count > 0)
            {
                return PickBestImage(variant.Images);
            }
        }

        return null;
    }

    /// <summary>
    /// Resuelve la imagen representativa para una variante hija.
    /// Orden de prioridad:
    /// 1) Foto propia de la variante (<c>variant.Images</c>).
    /// 2) Foto del grupo en el padre que coincida con los atributos de eje de la variante
    ///    (incluyendo soporte para <c>{eje}_hex</c> y claves compuestas multi-eje con <c>|</c>).
    /// 3) Foto general del modelo en el padre (<c>GroupValue == null</c>).
    /// 4) Fallback a cualquier imagen disponible en el padre.
    /// </summary>
    public static CatalogItemImage? ResolveVariantImage(
        CatalogItem variant,
        CatalogItem? parent = null)
    {
        ArgumentNullException.ThrowIfNull(variant);

        if (variant.Images.Count > 0)
        {
            return PickBestImage(variant.Images);
        }

        var effectiveParent = parent ?? variant.Parent;
        if (effectiveParent is null || effectiveParent.Images.Count == 0)
        {
            return null;
        }

        var parentGroupImages = effectiveParent.Images
            .Where(i => !string.IsNullOrWhiteSpace(i.GroupValue))
            .ToList();

        if (parentGroupImages.Count > 0)
        {
            var byNormalizedGroup = parentGroupImages
                .GroupBy(i => NormalizeGroupKey(i.GroupValue!), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => PickBestImage(g)!, StringComparer.OrdinalIgnoreCase);

            var axes = ParseMatrixAxes(effectiveParent.VariantDimensionsJson);
            foreach (var candidate in ResolveVariantGroupKeyCandidates(variant, axes))
            {
                if (byNormalizedGroup.TryGetValue(NormalizeGroupKey(candidate), out var matched))
                {
                    return matched;
                }
            }
        }

        var parentModelImages = effectiveParent.Images
            .Where(i => string.IsNullOrWhiteSpace(i.GroupValue))
            .ToList();
        if (parentModelImages.Count > 0)
        {
            return PickBestImage(parentModelImages);
        }

        return PickBestImage(effectiveParent.Images);
    }

    /// <summary>
    /// Claves candidatas de grupo de fotos para una variante.
    /// Soporta ejes simples, ejes de color donde el atributo guarda la etiqueta en <c>{eje}</c>
    /// y el código hexadecimal en <c>{eje}_hex</c>, y combinaciones multi-eje separadas por <c>|</c>.
    /// </summary>
    public static IReadOnlyList<string> ResolveVariantGroupKeyCandidates(
        CatalogItem variant,
        IReadOnlyList<MatrixAxisSpec> axes)
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

            IReadOnlyList<string> CandidateValuesOfAxis(MatrixAxisSpec axis)
            {
                var candidates = new List<string>(2);
                var hexKey = $"{axis.Name}_hex";

                var hexMatch = properties.FirstOrDefault(p =>
                    string.Equals(p.Name, hexKey, StringComparison.OrdinalIgnoreCase)
                    && p.Value.ValueKind == JsonValueKind.String);
                if (hexMatch.Value.ValueKind == JsonValueKind.String)
                {
                    var hexVal = hexMatch.Value.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(hexVal))
                    {
                        candidates.Add(hexVal);
                    }
                }

                var labelMatch = properties.FirstOrDefault(p =>
                    string.Equals(p.Name, axis.Name, StringComparison.OrdinalIgnoreCase)
                    && p.Value.ValueKind == JsonValueKind.String);
                if (labelMatch.Value.ValueKind == JsonValueKind.String)
                {
                    var labelVal = labelMatch.Value.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(labelVal)
                        && !candidates.Contains(labelVal, StringComparer.OrdinalIgnoreCase))
                    {
                        candidates.Add(labelVal);
                    }
                }

                return candidates;
            }

            var groupAxes = axes.Where(a => a.PhotoGroup).ToList();
            if (groupAxes.Count > 0)
            {
                var perAxisCandidates = groupAxes.Select(CandidateValuesOfAxis).ToList();
                if (perAxisCandidates.All(c => c.Count > 0))
                {
                    return BuildCartesianGroupKeys(perAxisCandidates);
                }

                return Array.Empty<string>();
            }

            var fallbackCandidates = new List<string>();
            foreach (var axis in axes)
            {
                foreach (var val in CandidateValuesOfAxis(axis))
                {
                    if (!fallbackCandidates.Contains(val, StringComparer.OrdinalIgnoreCase))
                    {
                        fallbackCandidates.Add(val);
                    }
                }
            }

            return fallbackCandidates;
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    public static IReadOnlyList<MatrixAxisSpec> ParseMatrixAxes(string? variantDimensionsJson)
    {
        if (string.IsNullOrWhiteSpace(variantDimensionsJson))
        {
            return Array.Empty<MatrixAxisSpec>();
        }

        try
        {
            using var doc = JsonDocument.Parse(variantDimensionsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("dimensions", out var wrapped)
                && wrapped.ValueKind == JsonValueKind.Array)
            {
                root = wrapped;
            }

            if (root.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<MatrixAxisSpec>();
            }

            var axes = new List<MatrixAxisSpec>();
            foreach (var dim in root.EnumerateArray())
            {
                if (dim.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (!dim.TryGetProperty("name", out var nameEl) || nameEl.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var name = nameEl.GetString()?.Trim();
                if (string.IsNullOrEmpty(name))
                {
                    continue;
                }

                var values = new List<string>();
                if (dim.TryGetProperty("values", out var valuesEl) && valuesEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var v in valuesEl.EnumerateArray())
                    {
                        if (v.ValueKind == JsonValueKind.String)
                        {
                            var valStr = v.GetString()?.Trim();
                            if (!string.IsNullOrEmpty(valStr))
                            {
                                values.Add(valStr);
                            }
                        }
                    }
                }

                var photoGroup = dim.TryGetProperty("photoGroup", out var pgEl)
                    && pgEl.ValueKind == JsonValueKind.True;

                string? type = null;
                if (dim.TryGetProperty("type", out var typeEl) && typeEl.ValueKind == JsonValueKind.String)
                {
                    var candidate = typeEl.GetString()?.Trim().ToLowerInvariant();
                    if (candidate is "size" or "color" or "custom")
                    {
                        type = candidate;
                    }
                }

                axes.Add(new MatrixAxisSpec(name, values, photoGroup, type));
            }

            return axes;
        }
        catch (JsonException)
        {
            return Array.Empty<MatrixAxisSpec>();
        }
    }

    public static string NormalizeGroupKey(string rawKey)
    {
        if (string.IsNullOrWhiteSpace(rawKey))
        {
            return string.Empty;
        }

        if (!rawKey.Contains('|', StringComparison.Ordinal))
        {
            return rawKey.Trim();
        }

        return string.Join(
            '|',
            rawKey.Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Select(segment => segment.Trim()));
    }

    private static CatalogItemImage? PickBestImage(IEnumerable<CatalogItemImage> images) =>
        images
            .OrderByDescending(i => i.IsMain)
            .ThenBy(i => i.DisplayOrder)
            .FirstOrDefault();

    private static IEnumerable<string> ExpandAxisValueCandidates(string rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            yield break;
        }

        var trimmed = rawValue.Trim();
        yield return trimmed;

        var openParen = trimmed.LastIndexOf("(#", StringComparison.Ordinal);
        if (openParen >= 0 && trimmed.EndsWith(')'))
        {
            var hexCandidate = trimmed[(openParen + 1)..^1].Trim();
            if (hexCandidate.Length > 1)
            {
                yield return hexCandidate;
            }

            var labelPart = trimmed[..openParen].Trim();
            if (labelPart.Length > 0)
            {
                yield return labelPart;
            }
        }
    }

    private static List<string> BuildCartesianGroupKeys(List<IReadOnlyList<string>> sets)
    {
        if (sets.Count == 0 || sets.Any(s => s.Count == 0))
        {
            return [];
        }

        var results = new List<string> { string.Empty };
        foreach (var set in sets)
        {
            var next = new List<string>(results.Count * set.Count);
            foreach (var prefix in results)
            {
                foreach (var value in set)
                {
                    var trimmed = value.Trim();
                    next.Add(prefix.Length == 0 ? trimmed : $"{prefix}|{trimmed}");
                }
            }

            results = next;
        }

        return results;
    }
}
