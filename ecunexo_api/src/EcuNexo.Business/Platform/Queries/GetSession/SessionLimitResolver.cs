using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Platform.Queries.GetSession;

/// <summary>
/// Resuelve los límites de una lista de entitlements para exponerlos en la sesión.
/// </summary>
public static class SessionLimitResolver
{
    /// <summary>
    /// A partir de los entitlements del tenant, genera un diccionario plano de límites
    /// con claves compuestas: <c>{moduleCode}.{limitKey}</c> (ej. "invoicing.max_invoices_per_month").
    /// </summary>
    public static (
        IReadOnlyList<ModuleEntitlement>? Entitlements,
        IReadOnlyDictionary<string, int>? ResolvedLimits)
        Resolve(
            IReadOnlyList<ModuleEntitlement>? entitlements,
            int? fallbackMaxWarehouses = null,
            int? fallbackMaxUsers = null)
    {
        if ((entitlements is null || entitlements.Count == 0)
            && fallbackMaxWarehouses is null
            && fallbackMaxUsers is null)
        {
            return (null, null);
        }

        var limits = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        if (entitlements is not null)
        {
            foreach (var entitlement in entitlements)
            {
                var defaults = ModuleTierCatalog.GetDefaultsForTier(entitlement.ModuleCode, entitlement.Tier);

                // Aplica sobrescritos si los hay
                foreach (var (key, defaultValue) in defaults)
                {
                    var resolved = entitlement.GetLimit(key) ?? defaultValue;
                    var compositeKey = $"{entitlement.ModuleCode}.{key}";
                    limits[compositeKey] = resolved;
                }
            }
        }

        var warehouseKey = $"{TenantModuleCodes.Warehousing}.{ModuleTierCatalog.LimitMaxWarehouses}";
        if (fallbackMaxWarehouses is { } maxWarehouses && !limits.ContainsKey(warehouseKey))
        {
            limits[warehouseKey] = maxWarehouses;
        }

        var usersKey = $"{TenantModuleCodes.Identity}.{ModuleTierCatalog.LimitMaxUsers}";
        if (fallbackMaxUsers is { } maxUsers && !limits.ContainsKey(usersKey))
        {
            limits[usersKey] = maxUsers;
        }

        return (entitlements, limits);
    }
}
