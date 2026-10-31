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
            ["catalog.matrix.create"] = (
                TenantModuleCodes.Catalog,
                ModuleTierCatalog.LimitMaxProductTemplates),
            ["catalog.matrix.update"] = (
                TenantModuleCodes.Catalog,
                ModuleTierCatalog.LimitMaxProductTemplates),
            ["catalog.matrix.delete"] = (
                TenantModuleCodes.Catalog,
                ModuleTierCatalog.LimitMaxProductTemplates),
            ["catalog.scale.manage"] = (
                TenantModuleCodes.Catalog,
                ModuleTierCatalog.LimitMaxProductTemplates),
            ["catalog.template.manage"] = (
                TenantModuleCodes.Catalog,
                ModuleTierCatalog.LimitMaxProductTemplates),
        };

    public static bool TryResolve(
        string permissionCode,
        out (string ModuleCode, string LimitKey) flag) =>
        PermissionFlags.TryGetValue(permissionCode, out flag);
}
