using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class SubscriptionAccountRepository(EcuNexoDbContext db) : ISubscriptionAccountRepository
{
    public Task<SubscriptionAccount?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Set<SubscriptionAccount>().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);

    public Task<SubscriptionAccount?> GetByIdForUpdateAsync(Guid id, CancellationToken ct) =>
        db.Set<SubscriptionAccount>().FirstOrDefaultAsync(a => a.Id == id, ct);

    public Task<SubscriptionAccount?> GetByGrantIdAsync(Guid grantId, CancellationToken ct) =>
        db.Set<SubscriptionAccount>().AsNoTracking().FirstOrDefaultAsync(a => a.GrantId == grantId, ct);

    public Task<SubscriptionAccount?> GetByEmailForUpdateAsync(string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return db.Set<SubscriptionAccount>()
            .FirstOrDefaultAsync(a => a.Email == normalized, ct);
    }

    public Task<SubscriptionAccount?> GetBySubscriptionGroupIdForUpdateAsync(Guid subscriptionGroupId, CancellationToken ct) =>
        db.Set<SubscriptionAccount>().FirstOrDefaultAsync(a => a.SubscriptionGroupId == subscriptionGroupId, ct);

    public Task<SubscriptionAccount?> GetBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct) =>
        db.Set<SubscriptionAccount>().AsNoTracking()
            .FirstOrDefaultAsync(a => a.SubscriptionGroupId == subscriptionGroupId, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return db.Set<SubscriptionAccount>().AsNoTracking().AnyAsync(a => a.Email == normalized, ct);
    }

    public Task<bool> AnyAsync(CancellationToken ct) =>
        db.Set<SubscriptionAccount>().AsNoTracking().AnyAsync(ct);

    public async Task AddAsync(SubscriptionAccount account, CancellationToken ct) =>
        await db.Set<SubscriptionAccount>().AddAsync(account, ct).ConfigureAwait(false);
}
