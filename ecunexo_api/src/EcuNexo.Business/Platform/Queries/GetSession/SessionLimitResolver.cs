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
        Resolve(IReadOnlyList<ModuleEntitlement>? entitlements)
    {
        if (entitlements is null || entitlements.Count == 0)
        {
            return (null, null);
        }

        var limits = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var entitlement in entitlements)
        {
            // Catalog no tiene límites numéricos
            if (string.Equals(entitlement.ModuleCode, TenantModuleCodes.Catalog, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var defaults = ModuleTierCatalog.GetDefaultsForTier(entitlement.ModuleCode, entitlement.Tier);

            // Aplica sobrescritos si los hay
            foreach (var (key, defaultValue) in defaults)
            {
                var resolved = entitlement.GetLimit(key) ?? defaultValue;
                var compositeKey = $"{entitlement.ModuleCode}.{key}";
                limits[compositeKey] = resolved;
            }
        }

        return (entitlements, limits);
    }
}
