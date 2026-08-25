using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface IDepartmentRepository
{
    Task AddAsync(Department department, CancellationToken ct);

    Task<IReadOnlyList<Department>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<Department?> GetActiveByIdAsync(Guid tenantId, Guid departmentId, CancellationToken ct);

    Task<Department?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid departmentId, CancellationToken ct);

    Task<bool> NameExistsIgnoreCaseAsync(
        Guid tenantId,
        string name,
        CancellationToken ct,
        Guid? excludeDepartmentId = null);

    Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid departmentId, CancellationToken ct);
}
