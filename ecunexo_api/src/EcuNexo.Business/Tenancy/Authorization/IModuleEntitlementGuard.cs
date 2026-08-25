using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Authorization;

public interface IModuleEntitlementGuard
{
    /// <summary>
    /// Verifica que el tenant tenga contratado el módulo del permiso dado (legacy flat modules).
    /// </summary>
    Task<Result> RequireModuleForPermissionAsync(Guid tenantId, string permissionCode, CancellationToken ct);

    /// <summary>
    /// Verifica que el tenant tenga el módulo contratado y con tier suficiente para el permiso.
    /// También valida límites transaccionales si el permiso los requiere.
    /// </summary>
    Task<Result> RequireModuleForPermissionWithTierAsync(
        Guid tenantId,
        string permissionCode,
        ModuleTier? requiredTier,
        CancellationToken ct);
}
