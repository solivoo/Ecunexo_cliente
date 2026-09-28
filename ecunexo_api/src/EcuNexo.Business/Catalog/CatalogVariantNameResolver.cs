using System.Text.Json;

namespace EcuNexo.Business.Catalog;

/// <summary>Resuelve el nombre comercial de una variante desde sus atributos («Nombre»/«name»).</summary>
public static class CatalogVariantNameResolver
{
    private static readonly string[] NameKeys = ["nombre", "name"];

    public static string? ResolveFromAttributes(string? customAttributesJson)
    {
        if (string.IsNullOrWhiteSpace(customAttributesJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(customAttributesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (!NameKeys.Contains(property.Name.Trim().ToLowerInvariant())
                    || property.Value.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var value = property.Value.GetString()?.Trim();
                if (!string.IsNullOrEmpty(value))
                {
                    return value;
                }
            }
        }
        catch (JsonException)
        {
            // atributos inválidos: sin nombre derivado
        }

        return null;
    }
}
