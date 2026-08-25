using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IPolicyRepository
{
    Task AddAsync(Policy policy, CancellationToken ct);

    Task<IReadOnlyList<Policy>> ListByPermissionIdAsync(Guid permissionId, CancellationToken ct);
}
