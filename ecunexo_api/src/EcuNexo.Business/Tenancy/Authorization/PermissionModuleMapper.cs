using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Authorization;

/// <summary>
/// Resuelve el módulo de producto (<see cref="TenantModuleCodes"/>) a partir del código de permiso.
/// </summary>
public static class PermissionModuleMapper
{
    public static string? ResolveProductModule(string permissionCode)
    {
        if (string.IsNullOrWhiteSpace(permissionCode))
        {
            return null;
        }

        var normalized = permissionCode.Trim().ToLowerInvariant();
        if (normalized.StartsWith("facturacion.guias.remision.", StringComparison.OrdinalIgnoreCase))
        {
            return TenantModuleCodes.RemisionGuides;
        }

        if (normalized.StartsWith("facturacion.notas.credito.", StringComparison.OrdinalIgnoreCase)
            || normalized.StartsWith("facturacion.notas_credito.", StringComparison.OrdinalIgnoreCase)
            || normalized.StartsWith("facturacion.notascredito.", StringComparison.OrdinalIgnoreCase))
        {
            return TenantModuleCodes.Invoicing;
        }

        if (normalized.StartsWith("catalog.matrix.", StringComparison.OrdinalIgnoreCase))
        {
            return TenantModuleCodes.CatalogMatrix;
        }

        var dot = permissionCode.IndexOf('.');
        if (dot <= 0)
        {
            return null;
        }

        var prefix = permissionCode[..dot].Trim().ToLowerInvariant();
        return TenantModuleCodes.IsKnown(prefix) ? prefix : null;
    }
}
