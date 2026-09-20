using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface IVariantDimensionTemplateRepository
{
    Task<IReadOnlyList<VariantDimensionTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<VariantDimensionTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct);

    Task AddAsync(VariantDimensionTemplate template, CancellationToken ct);

    Task DeleteAsync(VariantDimensionTemplate template, CancellationToken ct);
}
