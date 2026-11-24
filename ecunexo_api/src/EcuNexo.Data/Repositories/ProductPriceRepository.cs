using System.Text.Json;
using EcuNexo.Business.Pricing;
using EcuNexo.Core.Catalog;
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
                ItemCostPrice = r.Item.CostPrice,
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
            costsByItem.TryGetValue(r.CatalogItemId, out var avgCost) && avgCost.HasValue
                ? avgCost
                : (r.ItemCostPrice is > 0m ? Math.Round(r.ItemCostPrice.Value, 4) : null),
            r.PricesIncludeTax)).ToList();
    }

    public async Task<ProductPriceMatrixPageResponse> GetMatrixPageAsync(
        ProductPriceMatrixFilter filter,
        CancellationToken ct)
    {
        var activeLists = await _db.PriceLists.AsNoTracking()
            .Where(l => l.TenantId == filter.TenantId && l.IsActive)
            .OrderByDescending(l => l.IsDefault)
            .ThenBy(l => l.Priority)
            .ThenBy(l => l.Name)
            .Select(l => new PriceListResponse(
                l.Id,
                l.Code,
                l.Name,
                l.Description,
                l.Currency,
                l.PricesIncludeTax,
                l.ValidFrom,
                l.ValidTo,
                l.Priority,
                l.IsDefault,
                l.IsActive,
                l.SuggestedMarginPercent))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var allActiveListIds = activeLists.Select(l => l.Id).ToList();
        var evalListIds = filter.PriceListIds is { Count: > 0 } requested
            ? allActiveListIds.Where(id => requested.Contains(id)).ToList()
            : allActiveListIds;

        var date = filter.Date;

        var baseItems = _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == filter.TenantId
                && i.DeletedAt == null
                && !i.IsMatrixParent
                && (i.Kind == CatalogItemKind.Physical || i.Kind == CatalogItemKind.Service));

        var totalSellableItems = await baseItems.CountAsync(ct).ConfigureAwait(false);

        var itemsMissingAnyPrice = allActiveListIds.Count == 0
            ? 0
            : await baseItems
                .Where(i => _db.ProductPrices
                    .Where(p => p.TenantId == filter.TenantId
                        && p.CatalogItemId == i.Id
                        && p.IsActive
                        && p.ValidFrom <= date
                        && (p.ValidTo == null || p.ValidTo.Value >= date)
                        && allActiveListIds.Contains(p.PriceListId))
                    .Select(p => p.PriceListId)
                    .Distinct()
                    .Count() < allActiveListIds.Count)
                .CountAsync(ct)
                .ConfigureAwait(false);

        var filteredItems = baseItems;

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            var pattern = $"%{term}%";
            var barcodeJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["barcode"] = term });
            var eanJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["ean"] = term });
            filteredItems = filteredItems.Where(i =>
                EF.Functions.ILike(i.Name, pattern)
                || (i.Sku != null && EF.Functions.ILike(i.Sku, pattern))
                || (i.Barcode != null && EF.Functions.ILike(i.Barcode, pattern))
                || EF.Functions.JsonContains(i.CustomAttributesJson, barcodeJson)
                || EF.Functions.JsonContains(i.CustomAttributesJson, eanJson));
        }

        if (filter.OnlyMissing && evalListIds.Count > 0)
        {
            filteredItems = filteredItems.Where(i => _db.ProductPrices
                .Where(p => p.TenantId == filter.TenantId
                    && p.CatalogItemId == i.Id
                    && p.IsActive
                    && p.ValidFrom <= date
                    && (p.ValidTo == null || p.ValidTo.Value >= date)
                    && evalListIds.Contains(p.PriceListId))
                .Select(p => p.PriceListId)
                .Distinct()
                .Count() < evalListIds.Count);
        }

        var totalCount = await filteredItems.CountAsync(ct).ConfigureAwait(false);

        var pageItems = await filteredItems
            .OrderBy(i => i.Name)
            .ThenBy(i => i.Sku)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(i => new
            {
                i.Id,
                i.Name,
                i.Sku,
                i.Kind,
                i.CostPrice,
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (pageItems.Count == 0)
        {
            return new ProductPriceMatrixPageResponse(
                activeLists,
                Array.Empty<ProductPriceMatrixRowResponse>(),
                totalCount,
                totalSellableItems,
                itemsMissingAnyPrice,
                filter.Page,
                filter.PageSize);
        }

        var pageItemIds = pageItems.Select(i => i.Id).ToList();

        var priceRows = evalListIds.Count == 0
            ? []
            : await (
                from p in _db.ProductPrices.AsNoTracking()
                join s in _db.VolumeDiscountSchemes.AsNoTracking()
                    on p.VolumeDiscountSchemeId equals (Guid?)s.Id into schemes
                from s in schemes.DefaultIfEmpty()
                where p.TenantId == filter.TenantId
                    && pageItemIds.Contains(p.CatalogItemId)
                    && evalListIds.Contains(p.PriceListId)
                    && p.IsActive
                    && p.ValidFrom <= date
                    && (p.ValidTo == null || p.ValidTo.Value >= date)
                select new
                {
                    p.Id,
                    p.CatalogItemId,
                    p.PriceListId,
                    p.Price,
                    p.ValidFrom,
                    p.VolumeDiscountSchemeId,
                    SchemeName = s != null ? s.Name : null,
                })
                .ToListAsync(ct)
                .ConfigureAwait(false);

        var stockStats = await _db.Stocks.AsNoTracking()
            .Where(s => s.TenantId == filter.TenantId && pageItemIds.Contains(s.CatalogItemId))
            .Select(s => new { s.CatalogItemId, s.Quantity, s.AverageCost })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var stockCostsByItem = stockStats
            .GroupBy(s => s.CatalogItemId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var positiveStock = g.Where(s => s.Quantity > 0 && s.AverageCost > 0).ToList();
                    var totalQty = positiveStock.Sum(s => s.Quantity);
                    if (totalQty > 0m)
                    {
                        return (decimal?)Math.Round(positiveStock.Sum(s => s.Quantity * s.AverageCost) / totalQty, 4);
                    }

                    var withCost = g.Where(s => s.AverageCost > 0).ToList();
                    return withCost.Count > 0
                        ? (decimal?)Math.Round(withCost.Average(s => s.AverageCost), 4)
                        : null;
                });

        var pricesByItem = priceRows
            .GroupBy(r => r.CatalogItemId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .GroupBy(r => r.PriceListId)
                    .ToDictionary(
                        lg => lg.Key,
                        lg =>
                        {
                            var latest = lg.OrderByDescending(x => x.ValidFrom).First();
                            return new ProductPriceMatrixCellResponse(
                                latest.Id,
                                latest.Price,
                                latest.ValidFrom,
                                latest.VolumeDiscountSchemeId,
                                latest.SchemeName);
                        }));

        var resultRows = pageItems.Select(item =>
        {
            var cells = pricesByItem.TryGetValue(item.Id, out var dict)
                ? (IReadOnlyDictionary<Guid, ProductPriceMatrixCellResponse>)dict
                : new Dictionary<Guid, ProductPriceMatrixCellResponse>();

            decimal? referenceCost = null;
            string? costSource = null;
            if (stockCostsByItem.TryGetValue(item.Id, out var stockCost) && stockCost.HasValue)
            {
                referenceCost = stockCost.Value;
                costSource = "stock";
            }
            else if (item.CostPrice.HasValue && item.CostPrice.Value > 0)
            {
                referenceCost = Math.Round(item.CostPrice.Value, 4);
                costSource = "catalog";
            }

            var schemeCell = cells.Values.FirstOrDefault(c => c.VolumeDiscountSchemeId.HasValue);

            return new ProductPriceMatrixRowResponse(
                item.Id,
                item.Name,
                item.Sku,
                item.Kind,
                referenceCost,
                costSource,
                schemeCell?.VolumeDiscountSchemeId,
                schemeCell?.VolumeDiscountSchemeName,
                cells);
        }).ToList();

        return new ProductPriceMatrixPageResponse(
            activeLists,
            resultRows,
            totalCount,
            totalSellableItems,
            itemsMissingAnyPrice,
            filter.Page,
            filter.PageSize);
    }

    public async Task<IReadOnlyList<ProductPrice>> ListTrackedForBulkUpsertAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> priceListIds,
        IReadOnlyCollection<Guid> catalogItemIds,
        DateOnly validFrom,
        DateOnly? validTo,
        CancellationToken ct)
    {
        if (priceListIds.Count == 0 || catalogItemIds.Count == 0)
        {
            return Array.Empty<ProductPrice>();
        }

        var maxDate = validTo ?? DateOnly.MaxValue;

        return await _db.ProductPrices
            .Include(p => p.Tiers)
            .Where(p => p.TenantId == tenantId
                && priceListIds.Contains(p.PriceListId)
                && catalogItemIds.Contains(p.CatalogItemId)
                && (p.ValidFrom == validFrom
                    || (p.IsActive
                        && p.ValidFrom <= maxDate
                        && (p.ValidTo == null || p.ValidTo.Value >= validFrom))))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }
}
