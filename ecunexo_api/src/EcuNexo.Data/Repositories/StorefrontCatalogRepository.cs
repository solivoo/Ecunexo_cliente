using EcuNexo.Business.Storefront;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StorefrontCatalogRepository : IStorefrontCatalogRepository
{
    private readonly EcuNexoDbContext _db;

    public StorefrontCatalogRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<(IReadOnlyList<CatalogItem> Items, int TotalCount)> ListActiveRootsAsync(
        Guid tenantId,
        StorefrontProductFilter filter,
        CancellationToken ct)
    {
        var query = _db.CatalogItems.AsNoTracking()
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
            .Where(i => i.TenantId == tenantId
                && i.DeletedAt == null
                && i.Status == CatalogItemStatus.Active
                && i.Kind == CatalogItemKind.Physical
                && i.ParentId == null);

        if (filter.CategoryIds is { Count: > 0 } categoryIds)
        {
            query = query.Where(i => i.CategoryId != null && categoryIds.Contains(i.CategoryId.Value));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = $"%{filter.Search.Trim()}%";
            query = query.Where(i =>
                EF.Functions.ILike(i.Name, pattern)
                || (i.Sku != null && EF.Functions.ILike(i.Sku, pattern)));
        }

        var totalCount = await query.CountAsync(ct).ConfigureAwait(false);

        if (filter.DefaultPriceListId is { } priceListId && filter.Sort is "price_asc" or "price_desc")
        {
            return await ListByResolvedPriceAsync(tenantId, priceListId, filter, query, totalCount, ct)
                .ConfigureAwait(false);
        }

        query = filter.Sort switch
        {
            "price_asc" => query
                .OrderBy(i => i.BasePrice == null)
                .ThenBy(i => i.BasePrice)
                .ThenBy(i => i.Name),
            "price_desc" => query
                .OrderBy(i => i.BasePrice == null)
                .ThenByDescending(i => i.BasePrice)
                .ThenBy(i => i.Name),
            "newest" => query
                .OrderByDescending(i => i.CreatedAt)
                .ThenBy(i => i.Name),
            _ => query.OrderBy(i => i.Name),
        };

        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return (items, totalCount);
    }

    private async Task<(IReadOnlyList<CatalogItem> Items, int TotalCount)> ListByResolvedPriceAsync(
        Guid tenantId,
        Guid priceListId,
        StorefrontProductFilter filter,
        IQueryable<CatalogItem> query,
        int totalCount,
        CancellationToken ct)
    {
        var date = filter.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var priced = query.Select(i => new
        {
            i.Id,
            i.BasePrice,
            i.Name,
            ResolvedPrice = _db.ProductPrices
                .Where(p => p.TenantId == tenantId
                    && p.PriceListId == priceListId
                    && p.CatalogItemId == i.Id
                    && p.IsActive
                    && p.ValidFrom <= date
                    && (p.ValidTo == null || p.ValidTo >= date))
                .OrderByDescending(p => p.ValidFrom)
                .Select(p => (decimal?)p.Price)
                .FirstOrDefault(),
        });

        priced = filter.Sort == "price_desc"
            ? priced
                .OrderBy(x => x.ResolvedPrice == null && x.BasePrice == null)
                .ThenByDescending(x => x.ResolvedPrice ?? x.BasePrice)
                .ThenBy(x => x.Name)
            : priced
                .OrderBy(x => x.ResolvedPrice == null && x.BasePrice == null)
                .ThenBy(x => x.ResolvedPrice ?? x.BasePrice)
                .ThenBy(x => x.Name);

        var orderedIds = await priced
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(x => x.Id)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (orderedIds.Count == 0)
        {
            return (Array.Empty<CatalogItem>(), totalCount);
        }

        var pageItems = await _db.CatalogItems.AsNoTracking()
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
            .Where(i => orderedIds.Contains(i.Id))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var byId = pageItems.ToDictionary(i => i.Id);
        var ordered = orderedIds
            .Where(byId.ContainsKey)
            .Select(id => byId[id])
            .ToList();

        return (ordered, totalCount);
    }
}
