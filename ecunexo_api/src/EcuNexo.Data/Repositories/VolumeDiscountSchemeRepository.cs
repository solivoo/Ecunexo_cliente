using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class VolumeDiscountSchemeRepository : IVolumeDiscountSchemeRepository
{
    private readonly EcuNexoDbContext _db;

    public VolumeDiscountSchemeRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(VolumeDiscountScheme scheme, CancellationToken ct)
    {
        _db.VolumeDiscountSchemes.Add(scheme);
        return Task.CompletedTask;
    }

    public Task<VolumeDiscountScheme?> GetByIdAsync(Guid tenantId, Guid schemeId, CancellationToken ct) =>
        _db.VolumeDiscountSchemes.AsNoTracking()
            .Include(s => s.Tiers.OrderBy(t => t.QuantityFrom))
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == schemeId, ct);

    public Task<VolumeDiscountScheme?> GetTrackedByIdAsync(Guid tenantId, Guid schemeId, CancellationToken ct) =>
        _db.VolumeDiscountSchemes
            .Include(s => s.Tiers)
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == schemeId, ct);

    public async Task<IReadOnlyList<VolumeDiscountScheme>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        var query = _db.VolumeDiscountSchemes.AsNoTracking()
            .Include(s => s.Tiers.OrderBy(t => t.QuantityFrom))
            .Where(s => s.TenantId == tenantId);

        if (onlyActive)
        {
            query = query.Where(s => s.IsActive);
        }

        return await query
            .OrderBy(s => s.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> NameExistsAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return _db.VolumeDiscountSchemes.AnyAsync(
            s => s.TenantId == tenantId
                && s.Name == normalized
                && (excludeId == null || s.Id != excludeId.Value),
            ct);
    }
}
