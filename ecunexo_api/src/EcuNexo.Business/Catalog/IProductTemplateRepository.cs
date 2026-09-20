using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface IProductTemplateRepository
{
    Task<IReadOnlyList<ProductTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<ProductTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct);

    Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);

    Task AddAsync(ProductTemplate template, CancellationToken ct);

    Task DeleteAsync(ProductTemplate template, CancellationToken ct);
}
