using EcuNexo.Business.Platform.Queries.GetSession;
using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Business.Platform.Navigation;

internal static class MenuNavigationMapper
{
    public static IReadOnlyList<NavigationNodeDto> BuildTree(
        IReadOnlyList<MenuItem> flatItems,
        IReadOnlyCollection<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes)
    {
        var permSet = new HashSet<string>(permissionCodes, StringComparer.OrdinalIgnoreCase);
        var childMap = flatItems
            .Where(x => x.ParentId is not null)
            .GroupBy(x => x.ParentId!)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.SortOrder).ToList());

        return flatItems
            .Where(x => x.ParentId is null)
            .OrderBy(x => x.SortOrder)
            .Select(root => MapNode(root, childMap, permSet, enabledModuleCodes))
            .Where(node => node is not null)
            .Cast<NavigationNodeDto>()
            .ToList();
    }

    public static IReadOnlyList<string> ListVisibleContexts(
        IReadOnlyList<MenuItem> allActiveItems,
        IReadOnlyCollection<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes)
    {
        var contexts = Enum.GetValues<MenuContextKind>();
        var visible = new List<string>();

        foreach (var context in contexts)
        {
            var items = allActiveItems.Where(x => x.Context == context).ToList();
            if (items.Count == 0)
            {
                continue;
            }

            var tree = BuildTree(items, permissionCodes, enabledModuleCodes);
            if (tree.Count > 0)
            {
                visible.Add(context.ToString().ToLowerInvariant());
            }
        }

        return visible;
    }

    private static NavigationNodeDto? MapNode(
        MenuItem item,
        IReadOnlyDictionary<string, List<MenuItem>> childMap,
        HashSet<string> permSet,
        IReadOnlyList<string>? enabledModules)
    {
        var children = childMap.TryGetValue(item.Id, out var childItems)
            ? childItems
                .Select(child => MapNode(child, childMap, permSet, enabledModules))
                .Where(child => child is not null)
                .Cast<NavigationNodeDto>()
                .ToList()
            : [];

        var (disabled, reason) = Evaluate(item, permSet, enabledModules);

        // Contenedor de sección (sin ruta): solo visible si tiene hijos accesibles.
        if (string.IsNullOrWhiteSpace(item.Route)
            && children.Count == 0
            && !item.IsPlaceholder)
        {
            return null;
        }

        // Si hay hijos visibles, no marcar el contenedor como denegado por permiso del padre.
        if (children.Count > 0
            && disabled
            && !item.IsPlaceholder
            && string.Equals(reason, "No tienes permiso para esta sección.", StringComparison.Ordinal))
        {
            disabled = false;
            reason = null;
        }

        if (disabled && !item.IsPlaceholder && children.Count == 0)
        {
            return null;
        }

        if (!HasPermissionAccess(item.RequiredPermissions, permSet) && children.Count == 0)
        {
            return null;
        }

        return new NavigationNodeDto(
            item.Id,
            item.Label,
            item.Route,
            item.Icon,
            disabled,
            reason,
            item.IsPlaceholder,
            children);
    }

    private static (bool Disabled, string? Reason) Evaluate(
        MenuItem item,
        HashSet<string> permSet,
        IReadOnlyList<string>? enabledModules)
    {
        if (!IsModuleEnabled(item.ModuleCode, enabledModules))
        {
            return (true, "Módulo no incluido en tu plan.");
        }

        if (item.RequiredPermissions.Length > 0
            && !item.RequiredPermissions.Any(p => permSet.Contains(p)))
        {
            return (true, "No tienes permiso para esta sección.");
        }

        if (item.IsPlaceholder)
        {
            return (true, "Próximamente.");
        }

        return (false, null);
    }

    private static bool HasPermissionAccess(string[] required, HashSet<string> permSet)
    {
        if (required.Length == 0)
        {
            return true;
        }

        return required.Any(permSet.Contains);
    }

    private static bool IsModuleEnabled(string moduleCode, IReadOnlyList<string>? enabledModules)
    {
        if (enabledModules is null || enabledModules.Count == 0)
        {
            return true;
        }

        return enabledModules.Any(m => string.Equals(m, moduleCode, StringComparison.OrdinalIgnoreCase));
    }
}
