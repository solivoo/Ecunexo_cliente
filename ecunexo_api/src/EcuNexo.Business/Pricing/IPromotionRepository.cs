using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public interface IPromotionRepository
{
    Task AddAsync(Promotion promotion, CancellationToken ct);

    Task<Promotion?> GetTrackedByIdAsync(Guid tenantId, Guid promotionId, CancellationToken ct);

    Task<IReadOnlyList<Promotion>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct);

    Task<IReadOnlyList<Promotion>> ListApplicableAsync(
        Guid tenantId,
        Guid catalogItemId,
        Guid? parentCatalogItemId,
        DateTimeOffset moment,
        CancellationToken ct);

    Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);
}
