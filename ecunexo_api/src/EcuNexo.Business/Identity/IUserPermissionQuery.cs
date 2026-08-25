namespace EcuNexo.Business.Identity;

/// <summary>
/// Consulta si un usuario del tenant tiene un permiso vía RBAC (roles activos y vínculos rol-permiso).
/// </summary>
public interface IUserPermissionQuery
{
    Task<bool> UserHasPermissionAsync(Guid tenantId, Guid userId, Guid permissionId, CancellationToken ct);

    /// <summary>Códigos de permisos activos efectivos vía roles (distintos, ordenados).</summary>
    Task<IReadOnlyList<string>> ListEffectivePermissionCodesAsync(Guid tenantId, Guid userId, CancellationToken ct);
}
