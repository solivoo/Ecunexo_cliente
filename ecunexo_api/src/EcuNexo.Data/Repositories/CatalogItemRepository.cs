using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CatalogItemRepository : ICatalogItemRepository
{
    private readonly EcuNexoDbContext _db;

    public CatalogItemRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(CatalogItem item, CancellationToken ct)
    {
        _db.CatalogItems.Add(item);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CancellationToken ct)
    {
        var query = _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null);
        if (kind.HasValue)
        {
            query = query.Where(i => i.Kind == kind.Value);
        }

        return await query
            .OrderBy(i => i.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<CatalogItem?> GetActiveByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct) =>
        _db.CatalogItems.AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.TenantId == tenantId && i.Id == itemId && i.DeletedAt == null,
                ct);

    public Task<CatalogItem?> GetTrackedByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct) =>
        _db.CatalogItems.FirstOrDefaultAsync(
            i => i.TenantId == tenantId && i.Id == itemId && i.DeletedAt == null,
            ct);

    public async Task<IReadOnlyList<CatalogItem>> GetActiveByIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        return await _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null && ids.Contains(i.Id))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<bool> SkuExistsIgnoreCaseAsync(
        Guid tenantId,
        string sku,
        Guid? excludeId,
        CancellationToken ct)
    {
        var trimmed = sku.Trim().ToUpperInvariant();
        var query = _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null && i.Sku != null);
        if (excludeId.HasValue)
        {
            query = query.Where(i => i.Id != excludeId.Value);
        }

        var skus = await query.Select(i => i.Sku).ToListAsync(ct).ConfigureAwait(false);
        return skus.Exists(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
    }
}
