using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ShippingZoneRepository : IShippingZoneRepository
{
    private readonly EcuNexoDbContext _db;

    public ShippingZoneRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ShippingZone zone, CancellationToken ct)
    {
        _db.ShippingZones.Add(zone);
        return Task.CompletedTask;
    }

    public Task<ShippingZone?> GetByIdAsync(Guid tenantId, Guid zoneId, CancellationToken ct) =>
        _db.ShippingZones.AsNoTracking()
            .FirstOrDefaultAsync(z => z.TenantId == tenantId && z.Id == zoneId, ct);

    public Task<ShippingZone?> GetTrackedByIdAsync(Guid tenantId, Guid zoneId, CancellationToken ct) =>
        _db.ShippingZones
            .FirstOrDefaultAsync(z => z.TenantId == tenantId && z.Id == zoneId, ct);

    public Task<ShippingZone?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return _db.ShippingZones.AsNoTracking()
            .FirstOrDefaultAsync(z => z.TenantId == tenantId && z.Code == normalized, ct);
    }

    public Task<bool> ExistsCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var query = _db.ShippingZones.AsNoTracking()
            .Where(z => z.TenantId == tenantId && z.Code == normalized);

        if (excludeId.HasValue)
        {
            query = query.Where(z => z.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public async Task<IReadOnlyList<ShippingZone>> ListAsync(
        Guid tenantId,
        bool onlyActive,
        CancellationToken ct)
    {
        var query = _db.ShippingZones.AsNoTracking()
            .Where(z => z.TenantId == tenantId);

        if (onlyActive)
        {
            query = query.Where(z => z.IsActive);
        }

        return await query
            .OrderBy(z => z.SortOrder)
            .ThenBy(z => z.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public void Remove(ShippingZone zone)
    {
        _db.ShippingZones.Remove(zone);
    }
}
