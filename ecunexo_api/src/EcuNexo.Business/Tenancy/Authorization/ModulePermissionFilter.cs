using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Authorization;

/// <summary>
/// Filtra permisos del catálogo global según los módulos contratados en la licencia.
/// Soporta tanto el modelo legacy (<c>enabledModuleCodes</c>) como el nuevo modelo de tiers (<c>moduleEntitlements</c>).
/// </summary>
public static class ModulePermissionFilter
{
    /// <summary>
    /// Determina si un permiso está permitido según los módulos contratados.
    /// Soporta sobrecarga con ModuleEntitlements para validación por tier.
    /// </summary>
    public static bool IsPermittedForModules(
        string permissionCode,
        IReadOnlyList<string>? enabledModuleCodes)
    {
        var productModule = PermissionModuleMapper.ResolveProductModule(permissionCode);
        if (productModule is null)
        {
            return true;
        }

        if (enabledModuleCodes is null || enabledModuleCodes.Count == 0)
        {
            return true;
        }

        return enabledModuleCodes.Any(m => string.Equals(m, productModule, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Determina si un permiso está permitido según los módulos y tiers contratados.
    /// Si hay <paramref name="entitlements"/>, se usa el nuevo modelo (tiers).
    /// Si no, cae a <paramref name="enabledModuleCodes"/> (legacy).
    /// </summary>
    public static bool IsPermittedForModules(
        string permissionCode,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? entitlements)
    {
        if (entitlements is not null && entitlements.Count > 0)
        {
            return IsPermittedByEntitlements(permissionCode, entitlements, enabledModuleCodes);
        }

        return IsPermittedForModules(permissionCode, enabledModuleCodes);
    }

    /// <summary>
    /// Un módulo está contratado si figura en <paramref name="entitlements"/> o en <paramref name="enabledModuleCodes"/>.
    /// La licencia puede listar p. ej. <c>catalog</c> solo en <c>enabledModules</c> sin fila de tier.
    /// </summary>
    public static bool IsModuleEnabled(
        string moduleCode,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? entitlements)
    {
        if (entitlements is { Count: > 0 }
            && entitlements.Any(e => string.Equals(e.ModuleCode, moduleCode, StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        if (enabledModuleCodes is { Count: > 0 })
        {
            return enabledModuleCodes.Any(m => string.Equals(m, moduleCode, StringComparison.OrdinalIgnoreCase));
        }

        if (entitlements is null or { Count: 0 })
        {
            return TenantModuleCodes.IsKnown(moduleCode);
        }

        return false;
    }

    /// <summary>
    /// Evalúa si un permiso está autorizado según los entitlements del tenant/titular.
    /// Un permiso de un módulo no contratado o de tier insuficiente se rechaza.
    /// </summary>
    private static bool IsPermittedByEntitlements(
        string permissionCode,
        IReadOnlyList<ModuleEntitlement> entitlements,
        IReadOnlyList<string>? enabledModuleCodes)
    {
        var productModule = PermissionModuleMapper.ResolveProductModule(permissionCode);
        if (productModule is null)
        {
            return true;
        }

        return IsModuleEnabled(productModule, enabledModuleCodes, entitlements);
    }

    public static IReadOnlyList<string> FilterPermissionCodes(
        IEnumerable<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes) =>
        permissionCodes
            .Where(code => IsPermittedForModules(code, enabledModuleCodes))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// Filtra permisos usando el modelo de tiers.
    /// </summary>
    public static IReadOnlyList<string> FilterPermissionCodes(
        IEnumerable<string> permissionCodes,
        IReadOnlyList<string>? enabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? entitlements) =>
        permissionCodes
            .Where(code => IsPermittedForModules(code, enabledModuleCodes, entitlements))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();
}
