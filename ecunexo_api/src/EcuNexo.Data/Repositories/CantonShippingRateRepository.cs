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
        CancellationToken ct) =>
        await _db.CantonShippingRates
            .AsNoTracking()
            .Include(r => r.Canton)
            .Where(r => r.TenantId == tenantId
                && r.Canton != null
                && r.Canton.ProvinceId == provinceId
                && r.ShippingMethodId == shippingMethodId)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<CantonShippingRate?> GetByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        CancellationToken ct) =>
        _db.CantonShippingRates
            .AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.TenantId == tenantId
                    && r.CantonId == cantonId
                    && r.ShippingMethodId == shippingMethodId,
                ct);

    public Task<CantonShippingRate?> GetTrackedByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        CancellationToken ct) =>
        _db.CantonShippingRates
            .FirstOrDefaultAsync(
                r => r.TenantId == tenantId
                    && r.CantonId == cantonId
                    && r.ShippingMethodId == shippingMethodId,
                ct);

    public async Task<IReadOnlyList<CantonShippingRate>> ListTrackedByCantonsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> cantonIds,
        Guid? shippingMethodId,
        CancellationToken ct)
    {
        if (cantonIds.Count == 0)
        {
            return [];
        }

        return await _db.CantonShippingRates
            .Where(r => r.TenantId == tenantId
                && cantonIds.Contains(r.CantonId)
                && r.ShippingMethodId == shippingMethodId)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task AddAsync(CantonShippingRate rate, CancellationToken ct)
    {
        _db.CantonShippingRates.Add(rate);
        return Task.CompletedTask;
    }
}
