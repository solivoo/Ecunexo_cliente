using System.Globalization;
using System.Text;
using System.Text.Json;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

/// <summary>
/// Definición canónica de las facetas de la vitrina y utilidades para interpretar
/// atributos heterogéneos (claves duplicadas/acentos) hacia un conjunto estable.
/// MVP: el catálogo por tenant es pequeño y se resuelve en memoria; si el volumen
/// crece, estas claves pueden indexarse (jsonb/GIN) sin cambiar el contrato público.
/// </summary>
public static class StorefrontFacetCatalog
{
    private static readonly string[] TallaAliases = ["talla", "tallas", "tallas calcetin", "size"];
    private static readonly string[] ColorAliases = ["color", "colores"];
    private static readonly string[] ActividadAliases = ["actividad / uso", "actividad", "uso"];
    private static readonly string[] CanaAliases = ["tipo de cana", "tipo_cana", "cana", "caña"];
    private static readonly string[] MaterialAliases = ["material", "materiales"];
    private static readonly string[] MarcaAliases = ["marca"];
    private static readonly string[] ColeccionAliases = ["coleccion", "colección", "colecciones"];

    private static readonly StorefrontFacetDefinition[] Definitions =
    [
        new("talla", "Talla", TallaAliases),
        new("color", "Color", ColorAliases),
        new("actividad", "Actividad / Uso", ActividadAliases),
        new("cana", "Tipo de caña", CanaAliases),
        new("material", "Material", MaterialAliases),
        new("marca", "Marca", MarcaAliases),
        new("coleccion", "Colección", ColeccionAliases),
    ];

    private static readonly HashSet<string> ExcludedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "tags",
        "colores_secundarios",
        "colores secundarios",
        "precio",
        "precio_base",
        "baseprice",
        "codigo",
        "código",
        "sku",
        "barcode",
        "codigo_barras",
    };

    private static readonly Dictionary<string, StorefrontFacetDefinition> ByAlias = BuildAliasIndex();

    public static IReadOnlyList<StorefrontFacetDefinition> Facets => Definitions;

    public static bool TryCanonicalizeKey(string? rawKey, out string key, out string label)
    {
        key = string.Empty;
        label = string.Empty;

        if (string.IsNullOrWhiteSpace(rawKey) || ExcludedKeys.Contains(rawKey.Trim()))
        {
            return false;
        }

        if (!ByAlias.TryGetValue(NormalizeForMatch(rawKey), out var definition))
        {
            return false;
        }

        key = definition.Key;
        label = definition.Label;
        return true;
    }

    /// <summary>Limpia un valor para mostrarlo: recorta y colapsa espacios internos.</summary>
    public static string NormalizeValue(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(raw.Length);
        var pendingSpace = false;
        foreach (var character in raw.Trim())
        {
            if (char.IsWhiteSpace(character))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                builder.Append(' ');
                pendingSpace = false;
            }

            builder.Append(character);
        }

        return builder.ToString();
    }

    /// <summary>Clave de agrupación/comparación: minúsculas, sin acentos y con espacios colapsados.</summary>
    public static string NormalizeForMatch(string? raw)
    {
        var value = NormalizeValue(raw);
        if (value.Length == 0)
        {
            return string.Empty;
        }

        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark)
            {
                continue;
            }

            builder.Append(char.ToLowerInvariant(character));
        }

        return builder.ToString();
    }

    /// <summary>
    /// Extrae los atributos canónicos de un producto raíz: ficha personalizada,
    /// ruta jerárquica y dimensiones de cada variante. Deduplica por valor normalizado.
    /// </summary>
    public static Dictionary<string, List<string>> ExtractAttributes(CatalogItem item)
    {
        ArgumentNullException.ThrowIfNull(item);

        var attributes = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var seen = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);

        AddCustomAttributes(item.CustomAttributesJson, attributes, seen);
        AddHierarchyPath(item.HierarchyPathJson, attributes, seen);

        foreach (var variant in item.Variants)
        {
            AddCustomAttributes(variant.CustomAttributesJson, attributes, seen);
            AddHierarchyPath(variant.HierarchyPathJson, attributes, seen);
        }

        return attributes;
    }

    private static Dictionary<string, StorefrontFacetDefinition> BuildAliasIndex()
    {
        var index = new Dictionary<string, StorefrontFacetDefinition>(StringComparer.Ordinal);
        foreach (var definition in Definitions)
        {
            AddAlias(index, definition, definition.Key);
            foreach (var alias in definition.Aliases)
            {
                AddAlias(index, definition, alias);
            }
        }

        return index;
    }

    private static void AddAlias(
        Dictionary<string, StorefrontFacetDefinition> index,
        StorefrontFacetDefinition definition,
        string alias)
    {
        var normalized = NormalizeForMatch(alias);
        if (normalized.Length > 0)
        {
            index.TryAdd(normalized, definition);
        }
    }

    private static void AddCustomAttributes(
        string? json,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (!TryCanonicalizeKey(property.Name, out var key, out _))
                {
                    continue;
                }

                AddJsonValues(key, property.Value, attributes, seen);
            }
        }
        catch (JsonException)
        {
            // Atributos ilegibles no deben romper la vitrina.
        }
    }

    private static void AddJsonValues(
        string key,
        JsonElement element,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                AddValue(key, element.GetString(), attributes, seen);
                break;
            case JsonValueKind.Number:
                AddValue(key, element.GetRawText(), attributes, seen);
                break;
            case JsonValueKind.True:
                AddValue(key, "Sí", attributes, seen);
                break;
            case JsonValueKind.False:
                AddValue(key, "No", attributes, seen);
                break;
            case JsonValueKind.Array:
                foreach (var child in element.EnumerateArray())
                {
                    if (child.ValueKind is JsonValueKind.Array or JsonValueKind.Object or JsonValueKind.Null)
                    {
                        continue;
                    }

                    AddJsonValues(key, child, attributes, seen);
                }

                break;
        }
    }

    private static void AddHierarchyPath(
        string? json,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            foreach (var entry in doc.RootElement.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object
                    || !entry.TryGetProperty("name", out var nameElement)
                    || nameElement.ValueKind != JsonValueKind.String
                    || !entry.TryGetProperty("value", out var valueElement)
                    || valueElement.ValueKind != JsonValueKind.String
                    || !TryCanonicalizeKey(nameElement.GetString(), out var key, out _))
                {
                    continue;
                }

                AddValue(key, valueElement.GetString(), attributes, seen);
            }
        }
        catch (JsonException)
        {
            // Ruta ilegible no debe romper la vitrina.
        }
    }

    private static void AddValue(
        string key,
        string? raw,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        var display = NormalizeValue(raw);
        if (display.Length == 0)
        {
            return;
        }

        if (!seen.TryGetValue(key, out var keys))
        {
            keys = new HashSet<string>(StringComparer.Ordinal);
            seen[key] = keys;
        }

        if (!keys.Add(NormalizeForMatch(display)))
        {
            return;
        }

        if (!attributes.TryGetValue(key, out var values))
        {
            values = [];
            attributes[key] = values;
        }

        values.Add(display);
    }
}

public sealed record StorefrontFacetDefinition(
    string Key,
    string Label,
    IReadOnlyList<string> Aliases);
