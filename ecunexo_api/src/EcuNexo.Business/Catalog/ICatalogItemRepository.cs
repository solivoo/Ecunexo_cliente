using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public interface ICatalogItemRepository
{
    Task AddAsync(CatalogItem item, CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CatalogItemStatus? status,
        CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CancellationToken ct) =>
        ListActiveByTenantAsync(tenantId, kind, null, ct);

    Task<CatalogItem?> GetActiveByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct);

    Task<CatalogItem?> GetTrackedByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct);

    Task<IReadOnlyList<CatalogItem>> GetActiveByIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct);

    Task<bool> SkuExistsIgnoreCaseAsync(Guid tenantId, string sku, Guid? excludeId, CancellationToken ct);

    Task<bool> ExistsForCategoryAsync(Guid tenantId, Guid categoryId, CancellationToken ct);
}
