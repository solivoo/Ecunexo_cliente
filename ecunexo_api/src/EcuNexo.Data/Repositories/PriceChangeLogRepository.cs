using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PriceChangeLogRepository : IPriceChangeLogRepository
{
    private readonly EcuNexoDbContext _db;

    public PriceChangeLogRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(PriceChangeLog log, CancellationToken ct)
    {
        _db.PriceChangeLogs.Add(log);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<PriceHistoryRow>> ListAsync(
        Guid tenantId,
        Guid? catalogItemId,
        Guid? priceListId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct)
    {
        var query =
            from l in _db.PriceChangeLogs.AsNoTracking()
            join i in _db.CatalogItems.AsNoTracking() on l.CatalogItemId equals i.Id
            join p in _db.PriceLists.AsNoTracking() on l.PriceListId equals p.Id
            where l.TenantId == tenantId
            select new
            {
                Log = l,
                Item = i,
                List = p,
            };

        if (catalogItemId is { } itemId)
        {
            query = query.Where(r => r.Log.CatalogItemId == itemId);
        }

        if (priceListId is { } listId)
        {
            query = query.Where(r => r.Log.PriceListId == listId);
        }

        if (from is { } fromValue)
        {
            query = query.Where(r => r.Log.ChangedAt >= fromValue);
        }

        if (to is { } toValue)
        {
            query = query.Where(r => r.Log.ChangedAt <= toValue);
        }

        return await query
            .OrderByDescending(r => r.Log.ChangedAt)
            .Select(r => new PriceHistoryRow(
                r.Log.Id,
                r.Log.CatalogItemId,
                r.Item.Name,
                r.Item.Sku,
                r.Log.PriceListId,
                r.List.Code,
                r.List.Name,
                r.Log.PreviousPrice,
                r.Log.NewPrice,
                r.Log.ValidFrom,
                r.Log.ValidTo,
                r.Log.Reason,
                r.Log.ChangedBy,
                r.Log.ChangedAt))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }
}
