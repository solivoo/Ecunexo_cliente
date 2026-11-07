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
    private static readonly string[] CategoriaAliases = ["categoria", "categoría", "categorias", "categorías", "category", "linea", "línea", "departamento", "familia"];
    private static readonly string[] SubcategoriaAliases = ["subcategoria", "subcategoría", "subcategory", "subfamilia", "tipo", "tipo de producto"];
    private static readonly string[] MarcaAliases = ["marca", "brand", "fabricante"];
    private static readonly string[] TallaAliases = ["talla", "tallas", "tallas calcetin", "size"];
    private static readonly string[] ColorAliases = ["color", "colores"];
    private static readonly string[] GeneroAliases = ["genero", "género", "sexo", "gender"];
    private static readonly string[] ActividadAliases = ["actividad / uso", "actividad", "uso"];
    private static readonly string[] CanaAliases = ["tipo de cana", "tipo_cana", "cana", "caña"];
    private static readonly string[] MaterialAliases = ["material", "materiales", "composicion", "composición"];
    private static readonly string[] PresentacionAliases = ["presentacion", "presentación", "formato", "empaque", "envase", "unidad"];
    private static readonly string[] CapacidadAliases = ["capacidad", "peso", "volumen", "contenido", "medida", "dimension", "dimensión", "gramaje"];
    private static readonly string[] ModeloAliases = ["modelo", "estilo", "style", "referencia", "version", "versión"];
    private static readonly string[] ColeccionAliases = ["coleccion", "colección", "colecciones", "temporada"];

    private static readonly StorefrontFacetDefinition[] Definitions =
    [
        new("categoria", "Categoría", CategoriaAliases),
        new("subcategoria", "Subcategoría", SubcategoriaAliases),
        new("talla", "Talla", TallaAliases),
        new("color", "Color", ColorAliases),
        new("actividad", "Actividad / Uso", ActividadAliases),
        new("cana", "Tipo de caña", CanaAliases),
        new("material", "Material", MaterialAliases),
        new("marca", "Marca", MarcaAliases),
        new("coleccion", "Colección", ColeccionAliases),
        new("genero", "Género", GeneroAliases),
        new("presentacion", "Presentación", PresentacionAliases),
        new("capacidad", "Capacidad / Peso", CapacidadAliases),
        new("modelo", "Modelo", ModeloAliases),
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

    private static readonly char[] ValueSeparators = [',', ';', '|'];

    private static void AddValue(
        string key,
        string? raw,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return;
        }

        // Valores compuestos heredados ("Running, Skater, Crossfit") se exponen como opciones separadas.
        foreach (var part in raw.Split(
            ValueSeparators,
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            AddSingleValue(key, NormalizeValue(part), attributes, seen);
        }
    }

    private static void AddSingleValue(
        string key,
        string display,
        Dictionary<string, List<string>> attributes,
        Dictionary<string, HashSet<string>> seen)
    {
        if (display.Length == 0)
        {
            return;
        }

        display = key == "color" ? CanonicalizeColor(display) : Prettify(display);

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

    /// <summary>Uniforma el display: "deportiva" → "Deportiva", "ALGODÓN" → "Algodón".</summary>
    private static string Prettify(string value)
    {
        var hasLower = false;
        var hasUpper = false;
        foreach (var character in value)
        {
            if (char.IsLower(character))
            {
                hasLower = true;
            }
            else if (char.IsUpper(character))
            {
                hasUpper = true;
            }
        }

        if (!hasLower && !hasUpper)
        {
            return value;
        }

        if (hasLower && hasUpper)
        {
            return value;
        }

        var first = char.ToUpperInvariant(value[0]);
        var rest = hasLower ? value[1..] : value[1..].ToLowerInvariant();
        return string.Concat(first, rest);
    }

    private static readonly Dictionary<string, string> ColorNameMap = new(StringComparer.Ordinal)
    {
        ["negro"] = "Negro",
        ["black"] = "Negro",
        ["azabache"] = "Negro",

        ["blanco"] = "Blanco",
        ["white"] = "Blanco",
        ["marfil"] = "Blanco",
        ["crema"] = "Blanco",
        ["ivory"] = "Blanco",

        ["gris"] = "Gris",
        ["gray"] = "Gris",
        ["grey"] = "Gris",
        ["plata"] = "Gris",
        ["plateado"] = "Gris",
        ["silver"] = "Gris",

        ["azul"] = "Azul",
        ["blue"] = "Azul",
        ["marino"] = "Azul",
        ["navy"] = "Azul",
        ["royal"] = "Azul",
        ["indigo"] = "Azul",
        ["cobalto"] = "Azul",

        ["celeste"] = "Celeste",
        ["cyan"] = "Celeste",
        ["turquesa"] = "Celeste",
        ["aqua"] = "Celeste",
        ["light blue"] = "Celeste",
        ["sky"] = "Celeste",

        ["rojo"] = "Rojo",
        ["red"] = "Rojo",
        ["vino"] = "Rojo",
        ["granate"] = "Rojo",
        ["bordeaux"] = "Rojo",
        ["carmesi"] = "Rojo",
        ["burgundy"] = "Rojo",

        ["rosa"] = "Rosa",
        ["rosado"] = "Rosa",
        ["pink"] = "Rosa",
        ["fucsia"] = "Rosa",
        ["fuchsia"] = "Rosa",
        ["magenta"] = "Rosa",
        ["coral"] = "Rosa",
        ["salmon"] = "Rosa",

        ["verde"] = "Verde",
        ["green"] = "Verde",
        ["oliva"] = "Verde",
        ["olive"] = "Verde",
        ["militar"] = "Verde",
        ["menta"] = "Verde",
        ["mint"] = "Verde",
        ["esmeralda"] = "Verde",

        ["amarillo"] = "Amarillo",
        ["yellow"] = "Amarillo",
        ["oro"] = "Amarillo",
        ["dorado"] = "Amarillo",
        ["gold"] = "Amarillo",
        ["mostaza"] = "Amarillo",

        ["naranja"] = "Naranja",
        ["orange"] = "Naranja",
        ["ambar"] = "Naranja",
        ["durazno"] = "Naranja",

        ["morado"] = "Morado",
        ["purple"] = "Morado",
        ["violeta"] = "Morado",
        ["lila"] = "Morado",
        ["purpura"] = "Morado",

        ["cafe"] = "Café",
        ["marron"] = "Café",
        ["brown"] = "Café",
        ["chocolate"] = "Café",
        ["caramelo"] = "Café",

        ["beige"] = "Beige",
        ["kaki"] = "Beige",
        ["khaki"] = "Beige",
        ["arena"] = "Beige",
        ["nude"] = "Beige",
        ["camel"] = "Beige",
    };

    /// <summary>
    /// Agrupa códigos hex (#080808, #000000, etc.) o nombres libres en familias de color
    /// canónicas de vitrina para evitar filtros infinitos de swatches casi idénticos.
    /// </summary>
    public static string CanonicalizeColor(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var trimmed = raw.Trim();
        var normalized = NormalizeForMatch(trimmed);

        if (ColorNameMap.TryGetValue(normalized, out var canonical))
        {
            return canonical;
        }

        var hex = trimmed.StartsWith('#') ? trimmed[1..] : trimmed;
        if (TryParseHexRgb(hex, out var r, out var g, out var b))
        {
            return ClassifyRgbToColorFamily(r, g, b);
        }

        return Prettify(trimmed);
    }

    private static bool TryParseHexRgb(string hex, out byte r, out byte g, out byte b)
    {
        r = 0;
        g = 0;
        b = 0;

        if (hex.Length == 3)
        {
            return byte.TryParse($"{hex[0]}{hex[0]}", NumberStyles.HexNumber, CultureInfo.InvariantCulture, out r)
                && byte.TryParse($"{hex[1]}{hex[1]}", NumberStyles.HexNumber, CultureInfo.InvariantCulture, out g)
                && byte.TryParse($"{hex[2]}{hex[2]}", NumberStyles.HexNumber, CultureInfo.InvariantCulture, out b);
        }

        if (hex.Length == 6)
        {
            return byte.TryParse(hex[0..2], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out r)
                && byte.TryParse(hex[2..4], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out g)
                && byte.TryParse(hex[4..6], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out b);
        }

        return false;
    }

    private static string ClassifyRgbToColorFamily(byte rByte, byte gByte, byte bByte)
    {
        var r = rByte / 255f;
        var g = gByte / 255f;
        var b = bByte / 255f;

        var max = Math.Max(r, Math.Max(g, b));
        var min = Math.Min(r, Math.Min(g, b));
        var delta = max - min;
        var l = (max + min) / 2f;

        // Muy oscuros -> Negro (#000000, #080808, #111111, #1a1a1a)
        if (l <= 0.18f)
        {
            return "Negro";
        }

        // Muy claros con poca saturación -> Blanco (#ffffff, #f9fafb, #f3f4f6)
        var s = delta <= 0.0001f ? 0f : delta / (1f - Math.Abs((2f * l) - 1f));
        if (l >= 0.88f && s <= 0.25f)
        {
            return "Blanco";
        }

        // Saturación muy baja -> Gris neutro
        if (s <= 0.12f)
        {
            return "Gris";
        }

        float h;
        if (Math.Abs(max - r) < 0.0001f)
        {
            h = 60f * (((g - b) / delta) % 6f);
        }
        else if (Math.Abs(max - g) < 0.0001f)
        {
            h = 60f * (((b - r) / delta) + 2f);
        }
        else
        {
            h = 60f * (((r - g) / delta) + 4f);
        }

        if (h < 0f)
        {
            h += 360f;
        }

        return h switch
        {
            < 12f or >= 345f => l >= 0.65f ? "Rosa" : "Rojo",
            >= 12f and < 42f => (l < 0.45f && s < 0.70f) ? "Café" : (l > 0.72f && s < 0.45f ? "Beige" : "Naranja"),
            >= 42f and < 68f => (l > 0.72f && s < 0.45f) ? "Beige" : "Amarillo",
            >= 68f and < 165f => "Verde",
            >= 165f and < 205f => "Celeste",
            >= 205f and < 260f => l >= 0.65f ? "Celeste" : "Azul",
            >= 260f and < 310f => "Morado",
            _ => "Rosa",
        };
    }
}

public sealed record StorefrontFacetDefinition(
    string Key,
    string Label,
    IReadOnlyList<string> Aliases);
