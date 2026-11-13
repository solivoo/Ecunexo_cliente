using System.Globalization;
using System.Text;
using System.Text.Json;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Catálogo canónico de atributos base del sistema (dominio).
/// Son campos nativos del ítem / ejes de plantilla; no se crean como atributos custom del tenant.
/// </summary>
public static class SystemBaseAttributes
{
    public const string RoleItemField = "item-field";
    public const string RoleTemplateAxis = "template-axis";

    public static IReadOnlyList<UnitOfMeasureOption> UnitOfMeasureOptions { get; } =
    [
        new("UND", "Unidad (UND)"),
        new("PAR", "Par (PAR)"),
        new("DOC", "Docena (DOC)"),
        new("CJ", "Caja (CJ)"),
        new("PQT", "Paquete (PQT)"),
        new("KG", "Kilogramo (KG)"),
        new("G", "Gramo (G)"),
        new("LT", "Litro (LT)"),
        new("ML", "Mililitro (ML)"),
        new("M", "Metro (M)"),
        new("SERV", "Servicio / Hora (SERV)"),
    ];

    public static IReadOnlyList<SystemBaseAttributeDefinition> All { get; } =
    [
        new(
            "sys-base-kind",
            "Tipo de ítem",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            ["Físico (con inventario)", "Servicio (sin stock)"],
            null,
            false,
            RoleItemField,
            "Clasificación operativa del ítem (físico inventariable o servicio).",
            ["tipo de item", "tipo item", "kind", "tipo de producto"]),
        new(
            "sys-base-name",
            "Nombre del producto",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            [],
            null,
            false,
            RoleItemField,
            "Nombre comercial principal del producto, matriz o variante.",
            [
                "nombre",
                "nombre del producto",
                "nombre producto",
                "nombre de la matriz",
                "nombre de la matriz producto",
                "name",
                "titulo",
                "titulo del producto",
            ]),
        new(
            "sys-base-sku",
            "SKU / Código",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            [],
            null,
            false,
            RoleItemField,
            "Código único de inventario por SKU o código de modelo matriz.",
            [
                "sku",
                "codigo",
                "sku / codigo",
                "codigo de producto",
                "codigo de matriz",
                "codigo modelo",
                "referencia",
            ]),
        new(
            "sys-base-barcode",
            "Código de barras (EAN/UPC)",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            [],
            null,
            false,
            RoleItemField,
            "Identificador comercial de escaneo por código de barras (EAN, UPC, Code128).",
            [
                "codigo de barras",
                "codigo de barras (ean/upc)",
                "codigo_de_barras",
                "cod. barras",
                "cod barras",
                "barcode",
                "ean",
                "upc",
            ]),
        new(
            "sys-base-cost",
            "Precio base / Costo ($)",
            "custom",
            VariantDimensionTemplate.DataTypeNumber,
            [],
            "$",
            false,
            RoleItemField,
            "Costo unitario de compra/producción para calcular utilidad y margen.",
            [
                "costo",
                "precio base",
                "precio base / costo",
                "precio base / costo ($)",
                "precio de costo",
                "precio costo",
                "cost",
                "costprice",
            ]),
        new(
            "sys-base-price",
            "PVP / Precio de venta ($)",
            "custom",
            VariantDimensionTemplate.DataTypeNumber,
            [],
            "$",
            false,
            RoleItemField,
            "Precio unitario de venta al público (PVP) para facturación y tienda.",
            [
                "pvp",
                "pvp ($)",
                "precio",
                "precio de venta",
                "pvp / precio de venta",
                "pvp / precio de venta ($)",
                "price",
                "baseprice",
            ]),
        new(
            "sys-base-min-order",
            "Compra mínima",
            "custom",
            VariantDimensionTemplate.DataTypeNumber,
            [],
            "UND",
            false,
            RoleItemField,
            "Cantidad mínima de compra requerida por ítem o variante.",
            [
                "compra minima",
                "compra minima (cantidad)",
                "cantidad minima",
                "pedido minimo",
                "minorderquantity",
            ]),
        new(
            "sys-base-brand",
            "Marca / Fabricante",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            [],
            null,
            false,
            RoleItemField,
            "Marca comercial o fabricante del producto (incluido en todos los ítems).",
            ["marca", "fabricante", "marca / fabricante", "marca/fabricante", "brand"]),
        new(
            "sys-base-unit",
            "Unidad de medida",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            UnitOfMeasureOptions.Select(u => u.Value).ToArray(),
            null,
            false,
            RoleItemField,
            "Unidad comercial de despacho y presentación (UND, PAR, DOC, CJ, KG, etc.).",
            [
                "unidad de medida",
                "unidad_medida",
                "unidad medida",
                "unidad",
                "uom",
                "unit of measure",
            ]),
        new(
            "sys-base-description",
            "Descripción",
            "custom",
            VariantDimensionTemplate.DataTypeText,
            [],
            null,
            false,
            RoleItemField,
            "Descripción comercial y técnica del producto, matriz o variante.",
            [
                "descripcion",
                "descripcion del producto",
                "descripcion general",
                "descripcion general de la matriz",
                "description",
            ]),
        new(
            "system-colors",
            "Color",
            "color",
            VariantDimensionTemplate.DataTypeColor,
            [],
            null,
            true,
            RoleTemplateAxis,
            "Paleta de colores nombrados del sistema (nombre + hex) reutilizable en plantillas y variantes.",
            ["color", "colores"]),
    ];

    private static readonly HashSet<string> VariantBuiltinColumnIds = new(StringComparer.Ordinal)
    {
        "sys-base-sku",
        "sys-base-barcode",
        "sys-base-cost",
        "sys-base-price",
    };

    private static readonly Dictionary<string, SystemBaseAttributeDefinition> ByAlias;
    private static readonly Dictionary<string, SystemBaseAttributeDefinition> ItemFieldsByAlias;

    static SystemBaseAttributes()
    {
        ByAlias = new Dictionary<string, SystemBaseAttributeDefinition>(StringComparer.Ordinal);
        ItemFieldsByAlias = new Dictionary<string, SystemBaseAttributeDefinition>(StringComparer.Ordinal);

        foreach (var definition in All)
        {
            foreach (var key in definition.AliasKeys())
            {
                var norm = NormalizeToken(key);
                if (string.IsNullOrEmpty(norm))
                {
                    continue;
                }

                ByAlias[norm] = definition;
                if (definition.SystemRole == RoleItemField)
                {
                    ItemFieldsByAlias[norm] = definition;
                }
            }
        }
    }

    public static string NormalizeToken(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var normalized = raw.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            sb.Append(ch);
        }

        return string.Join(
            ' ',
            sb.ToString().Split([' ', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries));
    }

    public static SystemBaseAttributeDefinition? FindByNameOrAlias(string rawName)
    {
        var norm = NormalizeToken(rawName);
        if (string.IsNullOrEmpty(norm))
        {
            return null;
        }

        return ByAlias.TryGetValue(norm, out var match) ? match : null;
    }

    public static SystemBaseAttributeDefinition? FindItemFieldByNameOrAlias(string rawName)
    {
        var norm = NormalizeToken(rawName);
        if (string.IsNullOrEmpty(norm))
        {
            return null;
        }

        return ItemFieldsByAlias.TryGetValue(norm, out var match) ? match : null;
    }

    public static bool IsVariantBuiltInColumn(string rawKey)
    {
        var match = FindItemFieldByNameOrAlias(rawKey);
        return match is not null && VariantBuiltinColumnIds.Contains(match.Id);
    }

    /// <summary>
    /// Opción canónica que falta en el JSON enviado. Null si se conservan todas.
    /// </summary>
    public static string? FirstRemovedCanonicalValue(SystemBaseAttributeDefinition definition, string? json)
    {
        var present = ParseOptionNames(json);
        foreach (var required in definition.PredefinedValues)
        {
            var clean = required?.Trim();
            if (string.IsNullOrEmpty(clean))
            {
                continue;
            }

            if (!present.Any(v => v.Equals(clean, StringComparison.OrdinalIgnoreCase)))
            {
                return clean;
            }
        }

        return null;
    }

    private static List<string> ParseOptionNames(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var values = new List<string>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.String)
                {
                    var s = el.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(s))
                    {
                        values.Add(s);
                    }
                }
            }

            return values;
        }
        catch (JsonException)
        {
            return [];
        }
    }
}

public sealed record UnitOfMeasureOption(string Value, string Label);

public sealed record SystemBaseAttributeDefinition(
    string Id,
    string Name,
    string DimensionType,
    string DataType,
    IReadOnlyList<string> PredefinedValues,
    string? Unit,
    bool IsVariantAxis,
    string SystemRole,
    string Description,
    IReadOnlyList<string> Aliases)
{
    public IEnumerable<string> AliasKeys()
    {
        yield return Name;
        foreach (var alias in Aliases)
        {
            yield return alias;
        }
    }
}
