using EcuNexo.Business.Pricing;
using EcuNexo.Core.Pricing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PromotionRepository : IPromotionRepository
{
    private readonly EcuNexoDbContext _db;

    public PromotionRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Promotion promotion, CancellationToken ct)
    {
        _db.Promotions.Add(promotion);
        return Task.CompletedTask;
    }

    public Task<Promotion?> GetTrackedByIdAsync(Guid tenantId, Guid promotionId, CancellationToken ct) =>
        _db.Promotions
            .Include(p => p.Targets)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == promotionId, ct);

    public async Task<IReadOnlyList<Promotion>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        var query = _db.Promotions.AsNoTracking()
            .Include(p => p.Targets)
            .Where(p => p.TenantId == tenantId);
        if (onlyActive)
        {
            query = query.Where(p => p.IsActive);
        }

        return await query
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<Promotion>> ListApplicableAsync(
        Guid tenantId,
        Guid catalogItemId,
        Guid? parentCatalogItemId,
        Guid? categoryId,
        DateTimeOffset moment,
        CancellationToken ct)
    {
        var itemReference = catalogItemId.ToString();
        var parentReference = parentCatalogItemId?.ToString();
        var categoryReference = categoryId?.ToString();

        return await _db.Promotions.AsNoTracking()
            .Include(p => p.Targets)
            .Where(p => p.TenantId == tenantId
                && p.IsActive
                && p.StartsAt <= moment
                && (p.EndsAt == null || p.EndsAt >= moment)
                && p.Targets.Any(t =>
                    ((t.TargetType == PromotionTargetType.Product || t.TargetType == PromotionTargetType.Variant)
                        && (t.TargetReference == itemReference
                            || (parentReference != null && t.TargetReference == parentReference)))
                    || (t.TargetType == PromotionTargetType.Category
                        && categoryReference != null
                        && t.TargetReference == categoryReference)))
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct) =>
        _db.Promotions.AnyAsync(
            p => p.TenantId == tenantId
                && p.Code == code
                && (excludeId == null || p.Id != excludeId.Value),
            ct);
}
