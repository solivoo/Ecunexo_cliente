using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IUserRoleRepository
{
    Task AddAsync(UserRole assignment, CancellationToken ct);

    Task<IReadOnlyList<Guid>> ListRoleIdsForUserAsync(Guid tenantId, Guid userId, CancellationToken ct);

    Task<bool> AssignmentExistsAsync(Guid tenantId, Guid userId, Guid roleId, CancellationToken ct);

    /// <summary>Elimina la asignación si existe. Devuelve true si había fila que borrar.</summary>
    Task<bool> RemoveAsync(Guid tenantId, Guid userId, Guid roleId, CancellationToken ct);
}
