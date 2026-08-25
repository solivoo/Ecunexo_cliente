using System.Text.Json;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Molde jsonb de categoría: lista de campos <c>{ key, label, type, required }</c>.
/// </summary>
public static class CatalogAttributeSchema
{
    public const string EmptyArrayJson = "[]";
    public const string EmptyObjectJson = "{}";

    public static Result<string> NormalizeSchema(string? raw)
    {
        var json = string.IsNullOrWhiteSpace(raw) ? EmptyArrayJson : raw.Trim();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Result.Failure<string>(
                    new Error(
                        "catalog.schema.array",
                        "El molde de atributos debe ser un arreglo JSON.",
                        ErrorType.Validation));
            }

            foreach (var field in doc.RootElement.EnumerateArray())
            {
                if (field.ValueKind != JsonValueKind.Object)
                {
                    return Result.Failure<string>(
                        new Error(
                            "catalog.schema.field",
                            "Cada campo del molde debe ser un objeto JSON.",
                            ErrorType.Validation));
                }

                if (!field.TryGetProperty("key", out var keyEl)
                    || keyEl.ValueKind != JsonValueKind.String
                    || string.IsNullOrWhiteSpace(keyEl.GetString()))
                {
                    return Result.Failure<string>(
                        new Error(
                            "catalog.schema.key",
                            "Cada campo del molde requiere una clave (key) no vacía.",
                            ErrorType.Validation));
                }
            }

            return Result.Success(json);
        }
        catch (JsonException)
        {
            return Result.Failure<string>(
                new Error("catalog.schema.json", "El molde de atributos no es JSON válido.", ErrorType.Validation));
        }
    }

    public static Result<string> NormalizeAttributes(string? raw)
    {
        var json = string.IsNullOrWhiteSpace(raw) ? EmptyObjectJson : raw.Trim();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Result.Failure<string>(
                    new Error(
                        "catalog.attributes.object",
                        "Los atributos personalizados deben ser un objeto JSON.",
                        ErrorType.Validation));
            }

            return Result.Success(json);
        }
        catch (JsonException)
        {
            return Result.Failure<string>(
                new Error(
                    "catalog.attributes.json",
                    "Los atributos personalizados no son JSON válido.",
                    ErrorType.Validation));
        }
    }

    public static Result ValidateAgainstSchema(string schemaJson, string attributesJson)
    {
        var schema = NormalizeSchema(schemaJson);
        if (schema.IsFailure)
        {
            return Result.Failure(schema.Error!);
        }

        var attributes = NormalizeAttributes(attributesJson);
        if (attributes.IsFailure)
        {
            return Result.Failure(attributes.Error!);
        }

        using var schemaDoc = JsonDocument.Parse(schema.Value!);
        using var attrDoc = JsonDocument.Parse(attributes.Value!);
        var root = attrDoc.RootElement;

        foreach (var field in schemaDoc.RootElement.EnumerateArray())
        {
            var required = field.TryGetProperty("required", out var reqEl)
                && reqEl.ValueKind is JsonValueKind.True;
            if (!required)
            {
                continue;
            }

            var key = field.GetProperty("key").GetString()!;
            if (!root.TryGetProperty(key, out var value)
                || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined
                || (value.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(value.GetString()))
                || (value.ValueKind == JsonValueKind.Array && value.GetArrayLength() == 0))
            {
                return Result.Failure(
                    new Error(
                        "catalog.attributes.required",
                        $"Falta el atributo obligatorio «{key}».",
                        ErrorType.Validation));
            }
        }

        return Result.Success();
    }
}
