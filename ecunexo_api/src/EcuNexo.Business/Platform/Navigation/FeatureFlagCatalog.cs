using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Platform.Navigation;

/// <summary>
/// Opciones de plan (límites 0/1 del entitlement) que ocultan ítems de menú.
/// Clave: id del ítem de menú; valor: límite compuesto <c>{moduleCode}.{limitKey}</c>.
/// </summary>
internal static class FeatureFlagCatalog
{
    private static readonly Dictionary<string, string> ItemFlags = new(StringComparer.OrdinalIgnoreCase)
    {
        ["contabilidad-balances"] = $"{TenantModuleCodes.Accounting}.allow_financial_statements_export",
        ["contabilidad-cuentas"] = $"{TenantModuleCodes.Accounting}.enable_custom_subaccounts",
    };

    /// <summary>true cuando la opción está deshabilitada (límite 0) y el ítem debe ocultarse.</summary>
    public static bool IsDisabled(string itemId, IReadOnlyDictionary<string, int>? resolvedLimits)
    {
        if (resolvedLimits is null || !ItemFlags.TryGetValue(itemId, out var limitKey))
        {
            return false;
        }

        return resolvedLimits.TryGetValue(limitKey, out var value) && value <= 0;
    }
}
