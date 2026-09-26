using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Authorization;

/// <summary>
/// Permisos que dependen de una opción de plan (límite 0/1 del entitlement), además del módulo.
/// </summary>
internal static class FeatureFlagPermissionCatalog
{
    private static readonly Dictionary<string, (string ModuleCode, string LimitKey)> PermissionFlags =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["contabilidad.balances.read"] = (
                TenantModuleCodes.Accounting,
                ModuleTierCatalog.LimitAllowFinancialStatementsExport),
            ["contabilidad.cuentas.read"] = (
                TenantModuleCodes.Accounting,
                ModuleTierCatalog.LimitEnableCustomSubaccounts),
            ["contabilidad.cuentas.manage"] = (
                TenantModuleCodes.Accounting,
                ModuleTierCatalog.LimitEnableCustomSubaccounts),
        };

    public static bool TryResolve(
        string permissionCode,
        out (string ModuleCode, string LimitKey) flag) =>
        PermissionFlags.TryGetValue(permissionCode, out flag);
}
