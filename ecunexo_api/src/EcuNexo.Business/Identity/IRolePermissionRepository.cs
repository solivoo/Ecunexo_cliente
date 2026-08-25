using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IRolePermissionRepository
{
    Task AddAsync(RolePermission link, CancellationToken ct);

    Task<IReadOnlyList<Guid>> ListPermissionIdsByRoleAsync(Guid tenantId, Guid roleId, CancellationToken ct);

    Task<bool> LinkExistsAsync(Guid roleId, Guid permissionId, CancellationToken ct);

    /// <summary>Elimina el vínculo si existe. Devuelve true si había fila que borrar.</summary>
    Task<bool> RemoveAsync(Guid tenantId, Guid roleId, Guid permissionId, CancellationToken ct);
}
