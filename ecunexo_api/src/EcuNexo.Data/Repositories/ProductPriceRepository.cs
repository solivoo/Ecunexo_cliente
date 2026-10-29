using System.Text.Json;
using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ProductPriceRepository : IProductPriceRepository
{
    private readonly EcuNexoDbContext _db;

    public ProductPriceRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ProductPrice price, CancellationToken ct)
    {
        _db.ProductPrices.Add(price);
        return Task.CompletedTask;
    }

    public Task<bool> HasPricesForListAsync(Guid tenantId, Guid priceListId, CancellationToken ct) =>
        _db.ProductPrices.AnyAsync(
            p => p.TenantId == tenantId && p.PriceListId == priceListId,
            ct);

    public Task<ProductPrice?> GetByExactStartTrackedAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly validFrom,
        CancellationToken ct) =>
        _db.ProductPrices
            .Include(p => p.Tiers)
            .FirstOrDefaultAsync(
                p => p.TenantId == tenantId
                    && p.PriceListId == priceListId
                    && p.CatalogItemId == catalogItemId
                    && p.ValidFrom == validFrom,
                ct);

    public Task<ProductPrice?> GetByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct) =>
        _db.ProductPrices.AsNoTracking()
            .Include(p => p.Tiers)
            .Include(p => p.VolumeDiscountScheme)
                .ThenInclude(s => s!.Tiers)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == productPriceId, ct);

    public Task<ProductPrice?> GetTrackedByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct) =>
        _db.ProductPrices
            .Include(p => p.Tiers)
            .Include(p => p.VolumeDiscountScheme)
                .ThenInclude(s => s!.Tiers)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == productPriceId, ct);

    public Task<ProductPrice?> GetVigentAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly date,
        CancellationToken ct) =>
        _db.ProductPrices.AsNoTracking()
            .Include(p => p.Tiers)
            .Include(p => p.VolumeDiscountScheme)
                .ThenInclude(s => s!.Tiers)
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && p.CatalogItemId == catalogItemId
                && p.IsActive
                && p.ValidFrom <= date
                && (p.ValidTo == null || p.ValidTo >= date))
            .OrderByDescending(p => p.ValidFrom)
            .FirstOrDefaultAsync(ct);

    public Task<ProductPrice?> GetOverlappingTrackedAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid? excludeId,
        CancellationToken ct)
    {
        var maxDate = validTo ?? DateOnly.MaxValue;

        return _db.ProductPrices
            .Include(p => p.Tiers)
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && p.CatalogItemId == catalogItemId
                && p.IsActive
                && p.ValidFrom <= maxDate
                && (p.ValidTo == null || p.ValidTo.Value >= validFrom)
                && (excludeId == null || p.Id != excludeId.Value))
            .OrderBy(p => p.ValidFrom)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal>> ListVigentByItemIdsAsync(
        Guid tenantId,
        Guid priceListId,
        IReadOnlyCollection<Guid> catalogItemIds,
        DateOnly date,
        CancellationToken ct)
    {
        if (catalogItemIds.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        var rows = await _db.ProductPrices.AsNoTracking()
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && catalogItemIds.Contains(p.CatalogItemId)
                && p.IsActive
                && p.ValidFrom <= date
                && (p.ValidTo == null || p.ValidTo >= date))
            .Select(p => new { p.CatalogItemId, p.Price, p.ValidFrom })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return rows
            .GroupBy(r => r.CatalogItemId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(r => r.ValidFrom).First().Price);
    }

    public async Task<IReadOnlyList<ProductPriceListRow>> ListAsync(
        ProductPriceFilter filter,
        CancellationToken ct)
    {
        var date = filter.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var query =
            from p in _db.ProductPrices.AsNoTracking()
            join i in _db.CatalogItems.AsNoTracking() on p.CatalogItemId equals i.Id
            join l in _db.PriceLists.AsNoTracking() on p.PriceListId equals l.Id
            join s in _db.VolumeDiscountSchemes.AsNoTracking() on p.VolumeDiscountSchemeId equals (Guid?)s.Id into schemes
            from s in schemes.DefaultIfEmpty()
            where p.TenantId == filter.TenantId
            select new
            {
                Price = p,
                Item = i,
                List = l,
                SchemeName = s != null ? s.Name : null,
            };

        if (filter.PriceListId is { } priceListId)
        {
            query = query.Where(r => r.Price.PriceListId == priceListId);
        }

        if (filter.CatalogItemId is { } catalogItemId)
        {
            query = query.Where(r => r.Price.CatalogItemId == catalogItemId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            var pattern = $"%{term}%";
            var barcodeJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["barcode"] = term });
            var eanJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["ean"] = term });
            query = query.Where(r =>
                EF.Functions.ILike(r.Item.Name, pattern)
                || (r.Item.Sku != null && EF.Functions.ILike(r.Item.Sku, pattern))
                || EF.Functions.JsonContains(r.Item.CustomAttributesJson, barcodeJson)
                || EF.Functions.JsonContains(r.Item.CustomAttributesJson, eanJson));
        }

        if (filter.OnlyVigent)
        {
            query = query.Where(r => r.Price.IsActive
                && r.Price.ValidFrom <= date
                && (r.Price.ValidTo == null || r.Price.ValidTo.Value >= date));
        }

        var rows = await query
            .OrderBy(r => r.Item.Name)
            .ThenBy(r => r.List.Code)
            .Select(r => new
            {
                r.Price.Id,
                r.Price.CatalogItemId,
                ItemName = r.Item.Name,
                r.Item.Sku,
                r.Price.PriceListId,
                ListCode = r.List.Code,
                ListName = r.List.Name,
                r.Price.Price,
                r.Price.ValidFrom,
                r.Price.ValidTo,
                r.Price.IsActive,
                r.Price.VolumeDiscountSchemeId,
                r.SchemeName,
                r.List.PricesIncludeTax,
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (rows.Count == 0)
        {
            return Array.Empty<ProductPriceListRow>();
        }

        var itemIds = rows.Select(r => r.CatalogItemId).Distinct().ToList();
        var stockStats = await _db.Stocks.AsNoTracking()
            .Where(s => s.TenantId == filter.TenantId && itemIds.Contains(s.CatalogItemId))
            .Select(s => new { s.CatalogItemId, s.Quantity, s.AverageCost })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var costsByItem = stockStats
            .GroupBy(s => s.CatalogItemId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var positiveStock = g.Where(s => s.Quantity > 0 && s.AverageCost > 0).ToList();
                    var totalQty = positiveStock.Sum(s => s.Quantity);
                    if (totalQty > 0m)
                    {
                        return Math.Round(positiveStock.Sum(s => s.Quantity * s.AverageCost) / totalQty, 4);
                    }

                    var withCost = g.Where(s => s.AverageCost > 0).ToList();
                    return withCost.Count > 0
                        ? (decimal?)Math.Round(withCost.Average(s => s.AverageCost), 4)
                        : null;
                });

        return rows.Select(r => new ProductPriceListRow(
            r.Id,
            r.CatalogItemId,
            r.ItemName,
            r.Sku,
            r.PriceListId,
            r.ListCode,
            r.ListName,
            r.Price,
            r.ValidFrom,
            r.ValidTo,
            r.IsActive,
            r.VolumeDiscountSchemeId,
            r.SchemeName,
            costsByItem.TryGetValue(r.CatalogItemId, out var avgCost) ? avgCost : null,
            r.PricesIncludeTax)).ToList();
    }
}
