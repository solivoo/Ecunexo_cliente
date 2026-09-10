using System.Text.Json;
using System.Text.Json.Serialization;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Excel;

public sealed class RepairTemplateColumnDto
{
    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = "string"; // "string", "select", "number", "text"

    [JsonPropertyName("required")]
    public bool Required { get; set; }

    [JsonPropertyName("is_system_field")]
    public bool IsSystemField { get; set; }

    [JsonPropertyName("options")]
    public List<string> Options { get; set; } = [];

    [JsonPropertyName("defaultValue")]
    public string? DefaultValue { get; set; }

    [JsonPropertyName("example")]
    public string? Example { get; set; }
}

public sealed class RepairTemplateSchemaDto
{
    [JsonPropertyName("columns")]
    public List<RepairTemplateColumnDto> Columns { get; set; } = [];
}

public static class RepairTemplateSchemaDefaults
{
    public static string GetDefaultWhirlpoolSchemaJson()
    {
        var schema = new RepairTemplateSchemaDto
        {
            Columns =
            [
                new RepairTemplateColumnDto
                {
                    Key = "serial_number",
                    Label = "Número de Serie",
                    Type = "string",
                    Required = true,
                    IsSystemField = true,
                    Example = "SN123456789",
                },
                new RepairTemplateColumnDto
                {
                    Key = "model",
                    Label = "Modelo",
                    Type = "string",
                    Required = true,
                    IsSystemField = true,
                    Example = "WWG16AK",
                },
                new RepairTemplateColumnDto
                {
                    Key = "brand",
                    Label = "Marca",
                    Type = "string",
                    Required = true,
                    IsSystemField = true,
                    DefaultValue = "Whirlpool",
                    Example = "Whirlpool",
                },
                new RepairTemplateColumnDto
                {
                    Key = "product_line",
                    Label = "Línea de Producto",
                    Type = "select",
                    Required = true,
                    IsSystemField = true,
                    Options = ["Lavadora", "Refrigeradora", "Secadora", "Lavavajillas", "Microondas"],
                    Example = "Lavadora",
                },
                new RepairTemplateColumnDto
                {
                    Key = "damage_level",
                    Label = "Nivel de Golpe",
                    Type = "select",
                    Required = true,
                    IsSystemField = true,
                    Options = ["Nivel 1 (Leve)", "Nivel 2 (Medio)", "Nivel 3 (Grave)"],
                    Example = "Nivel 1 (Leve)",
                },
                new RepairTemplateColumnDto
                {
                    Key = "pallet_code",
                    Label = "Pallet / Posición de Carga",
                    Type = "string",
                    Required = false,
                    IsSystemField = false,
                    Example = "PLT-0042",
                },
                new RepairTemplateColumnDto
                {
                    Key = "damaged_component",
                    Label = "Parte Afectada",
                    Type = "string",
                    Required = false,
                    IsSystemField = false,
                    Example = "Panel frontal",
                },
                new RepairTemplateColumnDto
                {
                    Key = "origin_guide",
                    Label = "N° Guía de Remisión Origen",
                    Type = "string",
                    Required = false,
                    IsSystemField = false,
                    Example = "GR-2026-00871",
                },
                new RepairTemplateColumnDto
                {
                    Key = "origin_notes",
                    Label = "Observación de Despacho",
                    Type = "text",
                    Required = false,
                    IsSystemField = false,
                    Example = "Golpe superficial producido en estibado",
                },
            ]
        };

        return JsonSerializer.Serialize(schema, IndentedJsonOptions);
    }

    private static readonly JsonSerializerOptions IndentedJsonOptions = new() { WriteIndented = true };

    public static RepairTemplateSchemaDto ParseSchema(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new RepairTemplateSchemaDto();
        }

        try
        {
            return JsonSerializer.Deserialize<RepairTemplateSchemaDto>(json) ?? new RepairTemplateSchemaDto();
        }
        catch
        {
            return new RepairTemplateSchemaDto();
        }
    }

    public static DamageLevel ParseDamageLevel(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return DamageLevel.Level1;
        }

        var normalized = input.Trim().ToLowerInvariant();
        if (normalized.Contains("nivel 3") || normalized.Contains("level3") || normalized == "3" || normalized.Contains("grave") || normalized.Contains("estructural"))
        {
            return DamageLevel.Level3;
        }
        if (normalized.Contains("nivel 2") || normalized.Contains("level2") || normalized == "2" || normalized.Contains("medio") || normalized.Contains("chapa"))
        {
            return DamageLevel.Level2;
        }
        if (normalized.Contains("irreparable") || normalized.Contains("baja"))
        {
            return DamageLevel.Irreparable;
        }

        return DamageLevel.Level1;
    }
}
