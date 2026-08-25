using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class TenantRepository : ITenantRepository
{
    private readonly EcuNexoDbContext _db;

    public TenantRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task<bool> ExistsByIdAsync(Guid id, CancellationToken ct) =>
        _db.Tenants.AsNoTracking().AnyAsync(t => t.Id == id, ct);

    public Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);

    public Task<Tenant?> GetByIdForUpdateAsync(Guid id, CancellationToken ct) =>
        _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<IReadOnlyList<Tenant>> ListBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct) =>
        await _db.Tenants
            .AsNoTracking()
            .Where(t => t.SubscriptionGroupId == subscriptionGroupId && t.Status != TenantStatus.Cancelled)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<Tenant>> ListBySubscriptionGroupIdForUpdateAsync(
        Guid subscriptionGroupId,
        CancellationToken ct) =>
        await _db.Tenants
            .Where(t => t.SubscriptionGroupId == subscriptionGroupId && t.Status != TenantStatus.Cancelled)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<int> CountBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct) =>
        _db.Tenants.AsNoTracking().CountAsync(
            t => t.SubscriptionGroupId == subscriptionGroupId && t.Status != TenantStatus.Cancelled,
            ct);

    public Task AddAsync(Tenant tenant, CancellationToken ct)
    {
        _db.Tenants.Add(tenant);
        return Task.CompletedTask;
    }
}
