using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PriceListRepository : IPriceListRepository
{
    private readonly EcuNexoDbContext _db;

    public PriceListRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(PriceList list, CancellationToken ct)
    {
        _db.PriceLists.Add(list);
        return Task.CompletedTask;
    }

    public Task<PriceList?> GetByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct) =>
        _db.PriceLists.AsNoTracking()
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.Id == priceListId, ct);

    public Task<PriceList?> GetTrackedByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct) =>
        _db.PriceLists.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.Id == priceListId, ct);

    public Task<PriceList?> GetDefaultAsync(Guid tenantId, CancellationToken ct) =>
        _db.PriceLists.AsNoTracking()
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.IsDefault && l.IsActive, ct);

    public Task<PriceList?> GetDefaultTrackedAsync(Guid tenantId, CancellationToken ct) =>
        _db.PriceLists.FirstOrDefaultAsync(l => l.TenantId == tenantId && l.IsDefault && l.IsActive, ct);

    public async Task<IReadOnlyList<PriceList>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        var query = _db.PriceLists.AsNoTracking().Where(l => l.TenantId == tenantId);
        if (onlyActive)
        {
            query = query.Where(l => l.IsActive);
        }

        return await query
            .OrderByDescending(l => l.Priority)
            .ThenBy(l => l.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct) =>
        _db.PriceLists.AnyAsync(
            l => l.TenantId == tenantId
                && l.Code == code
                && (excludeId == null || l.Id != excludeId.Value),
            ct);
}
