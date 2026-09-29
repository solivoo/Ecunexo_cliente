using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ShippingRateRuleRepository : IShippingRateRuleRepository
{
    private readonly EcuNexoDbContext _db;

    public ShippingRateRuleRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ShippingRateRule rule, CancellationToken ct)
    {
        _db.ShippingRateRules.Add(rule);
        return Task.CompletedTask;
    }

    public Task<ShippingRateRule?> GetByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct) =>
        _db.ShippingRateRules.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == ruleId, ct);

    public Task<ShippingRateRule?> GetTrackedByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct) =>
        _db.ShippingRateRules
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == ruleId, ct);

    public async Task<IReadOnlyList<ShippingRateRule>> ListAsync(
        Guid tenantId,
        string? carrier,
        string? zone,
        bool onlyActive,
        CancellationToken ct)
    {
        var query = _db.ShippingRateRules.AsNoTracking()
            .Where(r => r.TenantId == tenantId);

        if (onlyActive)
        {
            query = query.Where(r => r.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(carrier))
        {
            var normalizedCarrier = carrier.Trim();
            query = query.Where(r => EF.Functions.ILike(r.Carrier, $"%{normalizedCarrier}%"));
        }

        if (!string.IsNullOrWhiteSpace(zone))
        {
            var normalizedZone = zone.Trim();
            query = query.Where(r => EF.Functions.ILike(r.Zone, $"%{normalizedZone}%"));
        }

        return await query
            .OrderBy(r => r.Zone)
            .ThenBy(r => r.SortOrder)
            .ThenBy(r => r.MinQuantity)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<ShippingRateRule>> ListActiveForResolutionAsync(
        Guid tenantId,
        string? zone,
        CancellationToken ct)
    {
        var query = _db.ShippingRateRules.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.IsActive);

        if (!string.IsNullOrWhiteSpace(zone))
        {
            var normalizedZone = zone.Trim();
            query = query.Where(r => r.Zone == "*" || EF.Functions.ILike(r.Zone, normalizedZone));
        }

        return await query
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Price)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public void Remove(ShippingRateRule rule)
    {
        _db.ShippingRateRules.Remove(rule);
    }
}
