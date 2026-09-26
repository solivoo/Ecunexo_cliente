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

        var (disabled, reason, lockKind) = Evaluate(item, permSet, enabledModules);
        var isContainer = string.IsNullOrWhiteSpace(item.Route);

        // Contenedor de sección (sin ruta): solo visible si tiene hijos accesibles o es placeholder.
        if (isContainer && children.Count == 0 && !item.IsPlaceholder)
        {
            return null;
        }

        // Bloqueo por permiso interno: se oculta, salvo contenedores con hijos visibles
        // (el permiso del padre no debe ocultar secciones con contenido accesible).
        if (lockKind == NavigationLockKind.Permission)
        {
            if (!isContainer || children.Count == 0)
            {
                return null;
            }

            disabled = false;
            reason = null;
            lockKind = NavigationLockKind.None;
        }

        // Un contenedor con hijos visibles nunca se muestra bloqueado: el candado vive en las hojas.
        if (isContainer && children.Count > 0)
        {
            disabled = false;
            reason = null;
            lockKind = NavigationLockKind.None;
        }

        return new NavigationNodeDto(
            item.Id,
            item.Label,
            item.Route,
            item.Icon,
            disabled,
            reason,
            item.IsPlaceholder,
            children,
            ToLockKind(lockKind),
            string.IsNullOrWhiteSpace(item.ModuleCode) ? null : item.ModuleCode);
    }

    private static (bool Disabled, string? Reason, NavigationLockKind Kind) Evaluate(
        MenuItem item,
        HashSet<string> permSet,
        IReadOnlyList<string>? enabledModules)
    {
        if (!IsModuleEnabled(item.ModuleCode, enabledModules))
        {
            return (true, "Módulo no incluido en tu plan.", NavigationLockKind.Module);
        }

        if (item.RequiredPermissions.Length > 0
            && !item.RequiredPermissions.Any(p => permSet.Contains(p)))
        {
            return (true, "No tienes permiso para esta sección.", NavigationLockKind.Permission);
        }

        if (item.IsPlaceholder)
        {
            return (true, "Próximamente.", NavigationLockKind.Placeholder);
        }

        return (false, null, NavigationLockKind.None);
    }

    private static string? ToLockKind(NavigationLockKind kind) => kind switch
    {
        NavigationLockKind.Module => "module",
        NavigationLockKind.Permission => "permission",
        NavigationLockKind.Placeholder => "placeholder",
        _ => null,
    };

    private static bool IsModuleEnabled(string moduleCode, IReadOnlyList<string>? enabledModules)
    {
        if (string.IsNullOrWhiteSpace(moduleCode))
        {
            return true;
        }

        if (enabledModules is null || enabledModules.Count == 0)
        {
            return true;
        }

        return enabledModules.Any(m => string.Equals(m, moduleCode, StringComparison.OrdinalIgnoreCase));
    }

    private enum NavigationLockKind
    {
        None,
        Module,
        Permission,
        Placeholder,
    }
}
