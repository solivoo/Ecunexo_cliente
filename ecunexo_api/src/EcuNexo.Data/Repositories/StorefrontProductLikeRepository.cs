using EcuNexo.Business.Storefront;
using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StorefrontProductLikeRepository : IStorefrontProductLikeRepository
{
    private readonly EcuNexoDbContext _db;

    public StorefrontProductLikeRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task<bool> ExistsAsync(
        Guid tenantId,
        Guid catalogItemId,
        string visitorId,
        CancellationToken ct = default)
    {
        var visitor = visitorId.Trim();
        return _db.StorefrontProductLikes.AsNoTracking()
            .AnyAsync(
                l => l.TenantId == tenantId
                    && l.CatalogItemId == catalogItemId
                    && l.VisitorId == visitor,
                ct);
    }

    public Task AddAsync(StorefrontProductLike like, CancellationToken ct = default)
    {
        _db.StorefrontProductLikes.Add(like);
        return Task.CompletedTask;
    }

    public async Task<bool> RemoveAsync(
        Guid tenantId,
        Guid catalogItemId,
        string visitorId,
        CancellationToken ct = default)
    {
        var visitor = visitorId.Trim();
        var like = await _db.StorefrontProductLikes
            .FirstOrDefaultAsync(
                l => l.TenantId == tenantId
                    && l.CatalogItemId == catalogItemId
                    && l.VisitorId == visitor,
                ct)
            .ConfigureAwait(false);

        if (like is null)
        {
            return false;
        }

        _db.StorefrontProductLikes.Remove(like);
        return true;
    }

    public async Task<IReadOnlyDictionary<Guid, int>> CountByItemIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> itemIds,
        CancellationToken ct = default)
    {
        if (itemIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        var counts = await _db.StorefrontProductLikes.AsNoTracking()
            .Where(l => l.TenantId == tenantId && itemIds.Contains(l.CatalogItemId))
            .GroupBy(l => l.CatalogItemId)
            .Select(group => new { CatalogItemId = group.Key, Count = group.Count() })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return counts.ToDictionary(row => row.CatalogItemId, row => row.Count);
    }

    public Task<int> CountForItemAsync(
        Guid tenantId,
        Guid catalogItemId,
        CancellationToken ct = default) =>
        _db.StorefrontProductLikes.AsNoTracking()
            .CountAsync(
                l => l.TenantId == tenantId && l.CatalogItemId == catalogItemId,
                ct);

    public async Task<StorefrontLikeMetricsDto> ListMetricsAsync(
        Guid tenantId,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        int top,
        CancellationToken ct = default)
    {
        var rows = await (
                from like in _db.StorefrontProductLikes.AsNoTracking()
                join item in _db.CatalogItems.AsNoTracking() on like.CatalogItemId equals item.Id
                where like.TenantId == tenantId
                    && like.CreatedAt >= fromUtc
                    && like.CreatedAt <= toUtc
                select new StorefrontLikeRow(like.CatalogItemId, item.Name, like.CreatedAt))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return StorefrontLikeMetricsCalculator.Build(rows, fromUtc, toUtc, top);
    }
}
