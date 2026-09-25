using System.Text.Json;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Plantilla reutilizable de escalas de variantes (tallas de medias, ropa, calzado, etc. o colores).
/// Permite al usuario seleccionar escalas predefinidas o crear escalas a la medida de su negocio.
/// </summary>
public sealed class VariantDimensionTemplate : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NameMaxLength = 120;
    public const int DimensionTypeMaxLength = 50;
    public const int DataTypeMaxLength = 20;
    public const int UnitMaxLength = 20;
    public const string EmptyArrayJson = "[]";

    public const string DataTypeText = "text";
    public const string DataTypeNumber = "number";
    public const string DataTypeBoolean = "boolean";
    public const string DataTypeColor = "color";
    public const string DataTypeMultiSelect = "multiselect";

    private static readonly string[] AllowedDataTypes =
        [DataTypeText, DataTypeNumber, DataTypeBoolean, DataTypeColor, DataTypeMultiSelect];

    public static bool IsValidDataType(string? dataType) =>
        string.IsNullOrWhiteSpace(dataType)
        || AllowedDataTypes.Contains(dataType.Trim().ToLowerInvariant());

    private VariantDimensionTemplate()
    {
        Name = string.Empty;
        DimensionType = "size";
        PredefinedValuesJson = EmptyArrayJson;
        DataType = DataTypeText;
        IsVariantAxis = true;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    /// <summary>
    /// Tipo de dimensión: "size", "color", "other".
    /// </summary>
    public string DimensionType { get; private set; }

    /// <summary>
    /// Tipo de dato que gobierna el control de captura en la interfaz:
    /// "text" | "number" | "boolean" | "color" | "multiselect".
    /// </summary>
    public string DataType { get; private set; }

    /// <summary>
    /// Indica si el atributo genera ejes físicos con SKU propio (true) o si es
    /// descriptivo del modelo (false), por ejemplo un color único del producto.
    /// </summary>
    public bool IsVariantAxis { get; private set; }

    /// <summary>Unidad de medida opcional para mostrar junto al valor (ej. cm, g, mm).</summary>
    public string? Unit { get; private set; }

    /// <summary>
    /// Arreglo JSON de valores predefinidos, ej: ["35-38", "39-41", "42-44"].
    /// </summary>
    public string PredefinedValuesJson { get; private set; }

    public bool IsSystemDefault { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<VariantDimensionTemplate> Create(
        Guid id,
        Guid tenantId,
        string name,
        string dimensionType,
        string predefinedValuesJson,
        string dataType = DataTypeText,
        bool isVariantAxis = true,
        string? unit = null,
        bool isSystemDefault = false,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<VariantDimensionTemplate>(
                new Error("catalog.variant_template.id.invalid", "El id de la plantilla es obligatorio.", ErrorType.Validation));
        }

        var nameNorm = NormalizeName(name);
        if (nameNorm.IsFailure)
        {
            return Result.Failure<VariantDimensionTemplate>(nameNorm.Error!);
        }

        var dimNorm = NormalizeDimensionType(dimensionType);
        if (dimNorm.IsFailure)
        {
            return Result.Failure<VariantDimensionTemplate>(dimNorm.Error!);
        }

        var dataNorm = NormalizeDataType(dataType);
        if (dataNorm.IsFailure)
        {
            return Result.Failure<VariantDimensionTemplate>(dataNorm.Error!);
        }

        var unitNorm = NormalizeUnit(unit);
        if (unitNorm.IsFailure)
        {
            return Result.Failure<VariantDimensionTemplate>(unitNorm.Error!);
        }

        var valuesNorm = NormalizeValuesJson(predefinedValuesJson, dataNorm.Value!, isVariantAxis);
        if (valuesNorm.IsFailure)
        {
            return Result.Failure<VariantDimensionTemplate>(valuesNorm.Error!);
        }

        return new VariantDimensionTemplate
        {
            Id = id,
            TenantId = tenantId,
            Name = nameNorm.Value!,
            DimensionType = dimNorm.Value!,
            DataType = dataNorm.Value!,
            IsVariantAxis = isVariantAxis,
            Unit = unitNorm.Value,
            PredefinedValuesJson = valuesNorm.Value!,
            IsSystemDefault = isSystemDefault,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        string name,
        string dimensionType,
        string predefinedValuesJson,
        string dataType = DataTypeText,
        bool isVariantAxis = true,
        string? unit = null,
        Guid? updatedBy = null)
    {
        var nameNorm = NormalizeName(name);
        if (nameNorm.IsFailure)
        {
            return Result.Failure(nameNorm.Error!);
        }

        var dimNorm = NormalizeDimensionType(dimensionType);
        if (dimNorm.IsFailure)
        {
            return Result.Failure(dimNorm.Error!);
        }

        var dataNorm = NormalizeDataType(dataType);
        if (dataNorm.IsFailure)
        {
            return Result.Failure(dataNorm.Error!);
        }

        var unitNorm = NormalizeUnit(unit);
        if (unitNorm.IsFailure)
        {
            return Result.Failure(unitNorm.Error!);
        }

        var valuesNorm = NormalizeValuesJson(predefinedValuesJson, dataNorm.Value!, isVariantAxis);
        if (valuesNorm.IsFailure)
        {
            return Result.Failure(valuesNorm.Error!);
        }

        Name = nameNorm.Value!;
        DimensionType = dimNorm.Value!;
        DataType = dataNorm.Value!;
        IsVariantAxis = isVariantAxis;
        Unit = unitNorm.Value;
        PredefinedValuesJson = valuesNorm.Value!;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    public static IReadOnlyList<(string Name, string DimensionType, string DataType, string[] Values)> GetSystemDefaultTemplates() =>
    [
        ("Medias / Calcetines", "size", DataTypeText, ["Infantil", "35-38", "39-41", "42-44", "45+"]),
        ("Ropa Adulto (Letras)", "size", DataTypeText, ["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
        ("Pantalones / Jeans (Pulgadas)", "size", DataTypeNumber, ["28", "30", "32", "34", "36", "38", "40"]),
        ("Calzado Adulto (Ecuador / EUR)", "size", DataTypeNumber, ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"]),
        ("Calzado Infantil", "size", DataTypeNumber, ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"]),
        ("Ropa Bebé (Meses)", "size", DataTypeText, ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "24M"]),
        ("Colores Básicos", "color", DataTypeColor, ["Blanco", "Negro", "Azul", "Rojo", "Gris", "Verde", "Beige", "Café"]),
    ];

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("catalog.variant_template.name.required", "El nombre de la escala es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.variant_template.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string> NormalizeDimensionType(string dimensionType)
    {
        if (string.IsNullOrWhiteSpace(dimensionType))
        {
            return Result.Success("size");
        }

        var norm = dimensionType.Trim().ToLowerInvariant();
        if (norm.Length > DimensionTypeMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.variant_template.type.length", $"El tipo no puede superar {DimensionTypeMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(norm);
    }

    private static Result<string> NormalizeDataType(string dataType)
    {
        if (string.IsNullOrWhiteSpace(dataType))
        {
            return Result.Success(DataTypeText);
        }

        var norm = dataType.Trim().ToLowerInvariant();
        if (!AllowedDataTypes.Contains(norm))
        {
            return Result.Failure<string>(
                new Error(
                    "catalog.variant_template.data_type.invalid",
                    "El tipo de dato debe ser texto, número, booleano o color.",
                    ErrorType.Validation));
        }

        return Result.Success(norm);
    }

    private static Result<string?> NormalizeUnit(string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit))
        {
            return Result.Success<string?>(null);
        }

        var trimmed = unit.Trim();
        if (trimmed.Length > UnitMaxLength)
        {
            return Result.Failure<string?>(
                new Error("catalog.variant_template.unit.length", $"La unidad no puede superar {UnitMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }

    private static Result<string> NormalizeValuesJson(string? json, string dataType, bool isVariantAxis = true)
    {
        if (isVariantAxis)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return Result.Failure<string>(
                    new Error("catalog.variant_template.values.required", "Un atributo que genera variantes con SKU debe contener al menos un valor.", ErrorType.Validation));
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return Result.Failure<string>(
                        new Error("catalog.variant_template.values.array", "Los valores de la escala deben ser un arreglo JSON.", ErrorType.Validation));
                }

                var values = new List<string>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.ValueKind != JsonValueKind.String)
                    {
                        return Result.Failure<string>(
                            new Error("catalog.variant_template.values.string", "Cada valor de la escala debe ser texto.", ErrorType.Validation));
                    }

                    var val = el.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(val))
                    {
                        values.Add(val);
                    }
                }

                if (values.Count == 0)
                {
                    return Result.Failure<string>(
                        new Error("catalog.variant_template.values.empty", "La escala debe contener al menos un valor no vacío.", ErrorType.Validation));
                }

                return Result.Success(JsonSerializer.Serialize(values));
            }
            catch (JsonException)
            {
                return Result.Failure<string>(
                    new Error("catalog.variant_template.values.json", "El formato JSON de los valores no es válido.", ErrorType.Validation));
            }
        }

        // Si es solo descriptivo (isVariantAxis == false), los valores predefinidos son opcionales
        if (string.IsNullOrWhiteSpace(json))
        {
            return Result.Success("[]");
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Result.Failure<string>(
                    new Error("catalog.variant_template.values.array", "Los valores del atributo deben ser un arreglo JSON.", ErrorType.Validation));
            }

            var values = new List<string>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.String)
                {
                    return Result.Failure<string>(
                        new Error("catalog.variant_template.values.string", "Cada valor del atributo debe ser texto.", ErrorType.Validation));
                }

                var val = el.GetString()?.Trim();
                if (!string.IsNullOrEmpty(val))
                {
                    values.Add(val);
                }
            }

            return Result.Success(JsonSerializer.Serialize(values));
        }
        catch (JsonException)
        {
            return Result.Failure<string>(
                new Error("catalog.variant_template.values.json", "El formato JSON de los valores no es válido.", ErrorType.Validation));
        }
    }
}
