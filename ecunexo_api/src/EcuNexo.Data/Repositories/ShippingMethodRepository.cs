using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ShippingMethodRepository : IShippingMethodRepository
{
    private readonly EcuNexoDbContext _db;

    public ShippingMethodRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ShippingMethod method, CancellationToken ct)
    {
        _db.ShippingMethods.Add(method);
        return Task.CompletedTask;
    }

    public Task<ShippingMethod?> GetByIdAsync(Guid tenantId, Guid methodId, CancellationToken ct) =>
        _db.ShippingMethods.AsNoTracking()
            .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.Id == methodId, ct);

    public Task<ShippingMethod?> GetTrackedByIdAsync(Guid tenantId, Guid methodId, CancellationToken ct) =>
        _db.ShippingMethods
            .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.Id == methodId, ct);

    public Task<ShippingMethod?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return _db.ShippingMethods.AsNoTracking()
            .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.Code == normalized, ct);
    }

    public Task<bool> ExistsCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var query = _db.ShippingMethods.AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.Code == normalized);

        if (excludeId.HasValue)
        {
            query = query.Where(m => m.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public async Task<IReadOnlyList<ShippingMethod>> ListAsync(
        Guid tenantId,
        bool onlyActive,
        CancellationToken ct)
    {
        var query = _db.ShippingMethods.AsNoTracking()
            .Where(m => m.TenantId == tenantId);

        if (onlyActive)
        {
            query = query.Where(m => m.IsActive);
        }

        return await query
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public void Remove(ShippingMethod method)
    {
        _db.ShippingMethods.Remove(method);
    }
}
