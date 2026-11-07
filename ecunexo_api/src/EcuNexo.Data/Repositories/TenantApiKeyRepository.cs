using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class TenantApiKeyRepository(EcuNexoDbContext db) : ITenantApiKeyRepository
{
    public Task AddAsync(TenantApiKey apiKey, CancellationToken ct) =>
        db.TenantApiKeys.AddAsync(apiKey, ct).AsTask();

    public async Task<IReadOnlyList<TenantApiKey>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await db.TenantApiKeys
            .AsNoTracking()
            .Where(k => k.TenantId == tenantId && k.DeletedAt == null)
            .OrderByDescending(k => k.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<TenantApiKey?> GetByIdAsync(Guid tenantId, Guid apiKeyId, CancellationToken ct) =>
        db.TenantApiKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.TenantId == tenantId && k.Id == apiKeyId && k.DeletedAt == null, ct);

    public Task<TenantApiKey?> GetByIdForUpdateAsync(Guid tenantId, Guid apiKeyId, CancellationToken ct) =>
        db.TenantApiKeys
            .FirstOrDefaultAsync(k => k.TenantId == tenantId && k.Id == apiKeyId && k.DeletedAt == null, ct);

    public Task<TenantApiKey?> GetByPrefixUnfilteredAsync(string keyPrefix, CancellationToken ct) =>
        db.TenantApiKeys
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.KeyPrefix == keyPrefix && k.DeletedAt == null, ct);

    public Task TouchLastUsedAsync(Guid tenantId, Guid apiKeyId, DateTimeOffset usedAt, CancellationToken ct) =>
        db.TenantApiKeys
            .IgnoreQueryFilters()
            .Where(k => k.TenantId == tenantId && k.Id == apiKeyId && k.DeletedAt == null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(k => k.LastUsedAt, usedAt),
                ct);
}
