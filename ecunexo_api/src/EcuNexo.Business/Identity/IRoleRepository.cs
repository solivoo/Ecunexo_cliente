using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IRoleRepository
{
    Task AddAsync(Role role, CancellationToken ct);

    Task<IReadOnlyList<Role>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<Role?> GetActiveByIdAsync(Guid tenantId, Guid roleId, CancellationToken ct);

    Task<Role?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid roleId, CancellationToken ct);

    Task<bool> NameExistsIgnoreCaseAsync(
        Guid tenantId,
        string name,
        CancellationToken ct,
        Guid? excludeRoleId = null);

    Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid roleId, CancellationToken ct);
}
