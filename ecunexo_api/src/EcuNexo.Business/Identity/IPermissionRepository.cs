using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IPermissionRepository
{
    Task AddAsync(Permission permission, CancellationToken ct);

    Task<IReadOnlyList<Permission>> ListNonDeletedOrderedByCodeAsync(CancellationToken ct);

    Task<Permission?> GetByIdAsync(Guid permissionId, CancellationToken ct);

    Task<bool> CodeExistsAsync(string normalizedCode, CancellationToken ct);

    Task<bool> ExistsActiveByIdAsync(Guid permissionId, CancellationToken ct);

    /// <summary>Código ya normalizado (minúsculas) como en dominio.</summary>
    Task<Guid?> GetActiveIdByCodeAsync(string normalizedCode, CancellationToken ct);
}
