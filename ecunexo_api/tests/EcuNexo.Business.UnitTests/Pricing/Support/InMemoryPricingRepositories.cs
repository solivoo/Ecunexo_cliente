using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.UnitTests.Pricing.Support;

internal sealed class InMemoryPriceListRepository : IPriceListRepository
{
    private readonly List<PriceList> _items = [];

    public IReadOnlyList<PriceList> Items => _items;

    public void Seed(PriceList list) => _items.Add(list);

    public Task AddAsync(PriceList list, CancellationToken ct)
    {
        _items.Add(list);
        return Task.CompletedTask;
    }

    public Task<PriceList?> GetByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct) =>
        Task.FromResult(Find(tenantId, priceListId));

    public Task<PriceList?> GetTrackedByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct) =>
        Task.FromResult(Find(tenantId, priceListId));

    public Task<PriceList?> GetDefaultAsync(Guid tenantId, CancellationToken ct) =>
        Task.FromResult(_items.FirstOrDefault(l => l.TenantId == tenantId && l.IsDefault && l.IsActive));

    public Task<PriceList?> GetDefaultTrackedAsync(Guid tenantId, CancellationToken ct) =>
        Task.FromResult(_items.FirstOrDefault(l => l.TenantId == tenantId && l.IsDefault && l.IsActive));

    public Task<IReadOnlyList<PriceList>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        IReadOnlyList<PriceList> result = _items
            .Where(l => l.TenantId == tenantId && (!onlyActive || l.IsActive))
            .OrderByDescending(l => l.Priority)
            .ThenBy(l => l.Code)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct) =>
        Task.FromResult(_items.Any(l =>
            l.TenantId == tenantId
            && l.Code == code
            && (excludeId is null || l.Id != excludeId.Value)));

    private PriceList? Find(Guid tenantId, Guid priceListId) =>
        _items.FirstOrDefault(l => l.TenantId == tenantId && l.Id == priceListId);
}

internal sealed class InMemoryProductPriceRepository : IProductPriceRepository
{
    private readonly List<ProductPrice> _items = [];

    public IReadOnlyList<ProductPrice> Items => _items;

    public void Seed(ProductPrice price) => _items.Add(price);

    public Task AddAsync(ProductPrice price, CancellationToken ct)
    {
        _items.Add(price);
        return Task.CompletedTask;
    }

    public Task<ProductPrice?> GetByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct) =>
        Task.FromResult(Find(tenantId, productPriceId));

    public Task<ProductPrice?> GetTrackedByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct) =>
        Task.FromResult(Find(tenantId, productPriceId));

    public Task<ProductPrice?> GetVigentAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly date,
        CancellationToken ct)
    {
        var result = _items
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && p.CatalogItemId == catalogItemId
                && p.IsActive
                && p.ValidFrom <= date
                && (p.ValidTo is null || p.ValidTo.Value >= date))
            .OrderByDescending(p => p.ValidFrom)
            .FirstOrDefault();
        return Task.FromResult(result);
    }

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
        var result = _items
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && p.CatalogItemId == catalogItemId
                && p.IsActive
                && p.ValidFrom <= maxDate
                && (p.ValidTo is null || p.ValidTo.Value >= validFrom)
                && (excludeId is null || p.Id != excludeId.Value))
            .OrderBy(p => p.ValidFrom)
            .FirstOrDefault();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyDictionary<Guid, decimal>> ListVigentByItemIdsAsync(
        Guid tenantId,
        Guid priceListId,
        IReadOnlyCollection<Guid> catalogItemIds,
        DateOnly date,
        CancellationToken ct)
    {
        var result = _items
            .Where(p => p.TenantId == tenantId
                && p.PriceListId == priceListId
                && catalogItemIds.Contains(p.CatalogItemId)
                && p.IsActive
                && p.ValidFrom <= date
                && (p.ValidTo is null || p.ValidTo.Value >= date))
            .GroupBy(p => p.CatalogItemId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(p => p.ValidFrom).First().Price);
        return Task.FromResult<IReadOnlyDictionary<Guid, decimal>>(result);
    }

    public Task<IReadOnlyList<ProductPriceListRow>> ListAsync(ProductPriceFilter filter, CancellationToken ct)
    {
        var date = filter.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        IReadOnlyList<ProductPriceListRow> rows = _items
            .Where(p => p.TenantId == filter.TenantId
                && (filter.PriceListId is null || p.PriceListId == filter.PriceListId.Value)
                && (!filter.OnlyVigent
                    || (p.IsActive && p.ValidFrom <= date && (p.ValidTo is null || p.ValidTo.Value >= date))))
            .Select(p => new ProductPriceListRow(
                p.Id,
                p.CatalogItemId,
                "Producto",
                null,
                p.PriceListId,
                "LISTA",
                "Lista",
                p.Price,
                p.ValidFrom,
                p.ValidTo,
                p.IsActive))
            .ToList();
        return Task.FromResult(rows);
    }

    private ProductPrice? Find(Guid tenantId, Guid productPriceId) =>
        _items.FirstOrDefault(p => p.TenantId == tenantId && p.Id == productPriceId);
}

internal sealed class InMemoryPromotionRepository : IPromotionRepository
{
    private readonly List<Promotion> _items = [];

    public IReadOnlyList<Promotion> Items => _items;

    public void Seed(Promotion promotion) => _items.Add(promotion);

    public Task AddAsync(Promotion promotion, CancellationToken ct)
    {
        _items.Add(promotion);
        return Task.CompletedTask;
    }

    public Task<Promotion?> GetTrackedByIdAsync(Guid tenantId, Guid promotionId, CancellationToken ct) =>
        Task.FromResult(_items.FirstOrDefault(p => p.TenantId == tenantId && p.Id == promotionId));

    public Task<IReadOnlyList<Promotion>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        IReadOnlyList<Promotion> result = _items
            .Where(p => p.TenantId == tenantId && (!onlyActive || p.IsActive))
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<Promotion>> ListApplicableAsync(
        Guid tenantId,
        Guid catalogItemId,
        Guid? parentCatalogItemId,
        DateTimeOffset moment,
        CancellationToken ct)
    {
        var itemReference = catalogItemId.ToString();
        var parentReference = parentCatalogItemId?.ToString();

        IReadOnlyList<Promotion> result = _items
            .Where(p => p.TenantId == tenantId
                && p.IsActive
                && p.StartsAt <= moment
                && (p.EndsAt is null || p.EndsAt >= moment)
                && p.Targets.Any(t =>
                    (t.TargetType == PromotionTargetType.Product || t.TargetType == PromotionTargetType.Variant)
                        && (t.TargetReference == itemReference
                            || (parentReference is not null && t.TargetReference == parentReference))))
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code)
            .ToList();
        return Task.FromResult(result);
    }

    public Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct) =>
        Task.FromResult(_items.Any(p =>
            p.TenantId == tenantId
            && p.Code == code
            && (excludeId is null || p.Id != excludeId.Value)));
}

internal sealed class InMemoryPriceChangeLogRepository : IPriceChangeLogRepository
{
    public List<PriceChangeLog> Entries { get; } = [];

    public Task AddAsync(PriceChangeLog log, CancellationToken ct)
    {
        Entries.Add(log);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<PriceHistoryRow>> ListAsync(
        Guid tenantId,
        Guid? catalogItemId,
        Guid? priceListId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct)
    {
        IReadOnlyList<PriceHistoryRow> result = Entries
            .Where(l => l.TenantId == tenantId
                && (catalogItemId is null || l.CatalogItemId == catalogItemId.Value)
                && (priceListId is null || l.PriceListId == priceListId.Value)
                && (from is null || l.ChangedAt >= from.Value)
                && (to is null || l.ChangedAt <= to.Value))
            .OrderByDescending(l => l.ChangedAt)
            .Select(l => new PriceHistoryRow(
                l.Id,
                l.CatalogItemId,
                "Producto",
                null,
                l.PriceListId,
                "LISTA",
                "Lista",
                l.PreviousPrice,
                l.NewPrice,
                l.ValidFrom,
                l.ValidTo,
                l.Reason,
                l.ChangedBy,
                l.ChangedAt))
            .ToList();
        return Task.FromResult(result);
    }
}

internal sealed class InMemoryUnitOfWork : IUnitOfWork
{
    public int SaveCount { get; private set; }

    public Task SaveChangesAsync(CancellationToken ct)
    {
        SaveCount++;
        return Task.CompletedTask;
    }

    public Task<bool> TrySaveChangesAsync(CancellationToken ct)
    {
        SaveCount++;
        return Task.FromResult(true);
    }
}

internal sealed class TestCallerContext : ICallerContext
{
    public Guid? UserId { get; init; }

    public Guid? ExplicitTenantId => null;

    public bool IsSubscriptionHolder => false;
}
