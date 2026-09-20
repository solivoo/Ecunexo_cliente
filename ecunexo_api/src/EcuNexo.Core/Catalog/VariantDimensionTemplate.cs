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
    public const string EmptyArrayJson = "[]";

    private VariantDimensionTemplate()
    {
        Name = string.Empty;
        DimensionType = "size";
        PredefinedValuesJson = EmptyArrayJson;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    /// <summary>
    /// Tipo de dimensión: "size", "color", "other".
    /// </summary>
    public string DimensionType { get; private set; }

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

        var valuesNorm = NormalizeValuesJson(predefinedValuesJson);
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

        var valuesNorm = NormalizeValuesJson(predefinedValuesJson);
        if (valuesNorm.IsFailure)
        {
            return Result.Failure(valuesNorm.Error!);
        }

        Name = nameNorm.Value!;
        DimensionType = dimNorm.Value!;
        PredefinedValuesJson = valuesNorm.Value!;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    public static IReadOnlyList<(string Name, string DimensionType, string[] Values)> GetSystemDefaultTemplates() =>
    [
        ("Medias / Calcetines", "size", ["Infantil", "35-38", "39-41", "42-44", "45+"]),
        ("Ropa Adulto (Letras)", "size", ["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
        ("Pantalones / Jeans (Pulgadas)", "size", ["28", "30", "32", "34", "36", "38", "40"]),
        ("Calzado Adulto (Ecuador / EUR)", "size", ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"]),
        ("Calzado Infantil", "size", ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"]),
        ("Ropa Bebé (Meses)", "size", ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "24M"]),
        ("Colores Básicos", "color", ["Blanco", "Negro", "Azul", "Rojo", "Gris", "Verde", "Beige", "Café"]),
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

    private static Result<string> NormalizeValuesJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Result.Failure<string>(
                new Error("catalog.variant_template.values.required", "Debe especificar al menos un valor para la escala.", ErrorType.Validation));
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
}
