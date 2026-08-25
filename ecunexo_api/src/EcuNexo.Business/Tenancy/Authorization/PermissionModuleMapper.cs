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

        var dot = permissionCode.IndexOf('.');
        if (dot <= 0)
        {
            return null;
        }

        var prefix = permissionCode[..dot].Trim().ToLowerInvariant();
        return TenantModuleCodes.IsKnown(prefix) ? prefix : null;
    }
}
