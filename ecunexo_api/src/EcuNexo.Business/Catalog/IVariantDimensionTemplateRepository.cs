using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface IVariantDimensionTemplateRepository
{
    Task<IReadOnlyList<VariantDimensionTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<VariantDimensionTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct);

    /// <summary>Indica si ya existe un atributo con ese nombre en el tenant (excluyendo opcionalmente un id).</summary>
    Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);

    Task AddAsync(VariantDimensionTemplate template, CancellationToken ct);

    Task DeleteAsync(VariantDimensionTemplate template, CancellationToken ct);
}
