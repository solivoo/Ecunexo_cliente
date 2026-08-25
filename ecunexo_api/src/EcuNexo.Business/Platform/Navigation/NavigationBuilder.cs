using System.Text.Json;
using EcuNexo.Business.Platform.Queries.GetSession;

namespace EcuNexo.Business.Platform.Navigation;

public sealed class EmbeddedNavigationBuilder : INavigationBuilder
{
    private static readonly IReadOnlyList<NavigationCatalogItem> Catalog = LoadCatalog();

    public IReadOnlyList<NavigationNodeDto> Build(
        IReadOnlyList<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes)
    {
        var permSet = new HashSet<string>(permissionCodes, StringComparer.OrdinalIgnoreCase);
        return Catalog
            .OrderBy(i => i.Order)
            .Select(i => MapNode(i, permSet, enabledModuleCodes))
            .ToList();
    }

    private static NavigationNodeDto MapNode(
        NavigationCatalogItem item,
        HashSet<string> permSet,
        IReadOnlyList<string>? enabledModules)
    {
        var (disabled, reason) = Evaluate(item, permSet, enabledModules);
        var children = (item.Children ?? [])
            .OrderBy(c => c.Order)
            .Select(c => MapNode(c, permSet, enabledModules))
            .ToList();

        return new NavigationNodeDto(
            item.Id,
            item.Label,
            item.Route,
            item.Icon,
            disabled,
            reason,
            item.Placeholder,
            children);
    }

    private static (bool Disabled, string? Reason) Evaluate(
        NavigationCatalogItem item,
        HashSet<string> permSet,
        IReadOnlyList<string>? enabledModules)
    {
        if (item.RequiredModule is { } mod && !IsModuleEnabled(mod, enabledModules))
        {
            return (true, "Módulo no incluido en tu plan.");
        }

        if (item.RequiredPermission is { } perm && !permSet.Contains(perm))
        {
            return (true, "No tienes permiso para esta sección.");
        }

        if (item.Placeholder)
        {
            return (true, "Próximamente.");
        }

        return (false, null);
    }

    private static bool IsModuleEnabled(string moduleCode, IReadOnlyList<string>? enabledModules)
    {
        if (enabledModules is null || enabledModules.Count == 0)
        {
            return true;
        }

        return enabledModules.Any(m => string.Equals(m, moduleCode, StringComparison.OrdinalIgnoreCase));
    }

    private static List<NavigationCatalogItem> LoadCatalog()
    {
        var assembly = typeof(EmbeddedNavigationBuilder).Assembly;
        const string resourceName = "EcuNexo.Business.Platform.Navigation.navigation.v1.json";
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Recurso embebido no encontrado: {resourceName}");
        using var reader = new StreamReader(stream);
        var json = reader.ReadToEnd();
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.EnumerateArray().Select(ParseCatalogItem).OrderBy(i => i.Order).ToList();
    }

    private static NavigationCatalogItem ParseCatalogItem(JsonElement element)
    {
        var children = element.TryGetProperty("children", out var childrenEl) && childrenEl.ValueKind == JsonValueKind.Array
            ? childrenEl.EnumerateArray().Select(ParseCatalogItem).ToList()
            : [];

        return new NavigationCatalogItem(
            GetString(element, "id"),
            GetString(element, "label"),
            GetOptionalString(element, "route"),
            GetOptionalString(element, "icon"),
            GetOptionalString(element, "requiredPermission"),
            GetOptionalString(element, "requiredModule"),
            element.TryGetProperty("order", out var orderEl) && orderEl.TryGetInt32(out var order) ? order : 0,
            element.TryGetProperty("placeholder", out var phEl) && phEl.ValueKind == JsonValueKind.True,
            children);
    }

    private static string GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
        {
            return string.Empty;
        }

        return prop.ValueKind == JsonValueKind.String ? prop.GetString() ?? string.Empty : string.Empty;
    }

    private static string? GetOptionalString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop) || prop.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : null;
    }
}
