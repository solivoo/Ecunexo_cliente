using System.Text.Json;
using System.Text.RegularExpressions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

/// <summary>Color nombrado de la paleta del tenant (nombre + hex), tal como lo define el admin.</summary>
public sealed record StorefrontColorDto(string Name, string Hex);

/// <summary>
/// Lee la paleta de colores nombrados del tenant desde la plantilla de atributo Color.
/// Fuente única de verdad: los nombres de color de productos y filtros deben existir aquí.
/// </summary>
public static partial class StorefrontColorPalette
{
    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexPattern();

    public static IReadOnlyList<StorefrontColorDto> FromTemplates(
        IEnumerable<VariantDimensionTemplate> templates)
    {
        ArgumentNullException.ThrowIfNull(templates);

        var colorTemplates = templates
            .Where(IsColorTemplate)
            .OrderByDescending(t => t.PredefinedValuesJson.Length)
            .ToList();

        foreach (var template in colorTemplates)
        {
            var palette = Parse(template.PredefinedValuesJson);
            if (palette.Count > 0)
            {
                return palette;
            }
        }

        return [];
    }

    private static bool IsColorTemplate(VariantDimensionTemplate template) =>
        template.Name.Trim().Equals("Color", StringComparison.OrdinalIgnoreCase)
        || template.DimensionType.Equals(VariantDimensionTemplate.DataTypeColor, StringComparison.OrdinalIgnoreCase);

    private static List<StorefrontColorDto> Parse(string? json)
    {
        var result = new List<StorefrontColorDto>();
        if (string.IsNullOrWhiteSpace(json))
        {
            return result;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in doc.RootElement.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object
                    || !entry.TryGetProperty("name", out var nameElement)
                    || nameElement.ValueKind != JsonValueKind.String
                    || !entry.TryGetProperty("hex", out var hexElement)
                    || hexElement.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var name = nameElement.GetString()?.Trim() ?? string.Empty;
                var hex = hexElement.GetString()?.Trim() ?? string.Empty;
                if (name.Length == 0 || !HexPattern().IsMatch(hex) || !seen.Add(name))
                {
                    continue;
                }

                result.Add(new StorefrontColorDto(name, hex.ToUpperInvariant()));
            }
        }
        catch (JsonException)
        {
            // Paleta ilegible no debe romper la vitrina.
        }

        return result;
    }
}
