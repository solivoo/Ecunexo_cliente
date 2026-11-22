using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CantonShippingRateRepository : ICantonShippingRateRepository
{
    private readonly EcuNexoDbContext _db;

    public CantonShippingRateRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CantonShippingRate>> ListByProvinceAsync(
        Guid tenantId,
        Guid provinceId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default) =>
        await _db.CantonShippingRates
            .AsNoTracking()
            .Include(r => r.Canton)
            .Where(r => r.TenantId == tenantId
                && r.Canton != null
                && r.Canton.ProvinceId == provinceId
                && r.ShippingMethodId == shippingMethodId
                && r.OriginCantonId == originCantonId)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<CantonShippingRate?> GetByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default) =>
        _db.CantonShippingRates
            .AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.TenantId == tenantId
                    && r.CantonId == cantonId
                    && r.ShippingMethodId == shippingMethodId
                    && r.OriginCantonId == originCantonId,
                ct);

    public Task<CantonShippingRate?> GetTrackedByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default) =>
        _db.CantonShippingRates
            .FirstOrDefaultAsync(
                r => r.TenantId == tenantId
                    && r.CantonId == cantonId
                    && r.ShippingMethodId == shippingMethodId
                    && r.OriginCantonId == originCantonId,
                ct);

    public async Task<IReadOnlyList<CantonShippingRate>> ListTrackedByCantonsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> cantonIds,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default)
    {
        if (cantonIds.Count == 0)
        {
            return [];
        }

        return await _db.CantonShippingRates
            .Where(r => r.TenantId == tenantId
                && cantonIds.Contains(r.CantonId)
                && r.ShippingMethodId == shippingMethodId
                && r.OriginCantonId == originCantonId)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<CantonShippingRate>> ListByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        CancellationToken ct = default) =>
        await _db.CantonShippingRates
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.CantonId == cantonId)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<Guid?> FindPrimaryOriginCantonIdAsync(
        Guid tenantId,
        CancellationToken ct = default) =>
        await _db.CantonShippingRates
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.IsEnabled && r.OriginCantonId != null)
            .GroupBy(r => r.OriginCantonId)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

    public Task AddAsync(CantonShippingRate rate, CancellationToken ct)
    {
        _db.CantonShippingRates.Add(rate);
        return Task.CompletedTask;
    }
}
