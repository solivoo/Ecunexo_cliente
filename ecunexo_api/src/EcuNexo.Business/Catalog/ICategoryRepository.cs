using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface ICategoryRepository
{
    Task AddAsync(Category category, CancellationToken ct);

    Task<IReadOnlyList<Category>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<Category?> GetActiveByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct);

    Task<Category?> GetTrackedByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct);

    Task<bool> NameExistsIgnoreCaseAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);

    Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct);
}
