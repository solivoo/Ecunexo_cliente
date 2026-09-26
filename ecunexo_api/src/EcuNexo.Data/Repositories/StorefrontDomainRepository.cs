using EcuNexo.Business.Storefront;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StorefrontDomainRepository : IStorefrontDomainRepository
{
    private readonly EcuNexoDbContext _db;

    public StorefrontDomainRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(StorefrontDomain domain, CancellationToken ct)
    {
        _db.StorefrontDomains.Add(domain);
        return Task.CompletedTask;
    }

    public void Remove(StorefrontDomain domain)
    {
        _db.StorefrontDomains.Remove(domain);
    }

    public Task<StorefrontDomain?> GetTrackedByIdAsync(
        Guid tenantId,
        Guid domainId,
        CancellationToken ct) =>
        _db.StorefrontDomains.FirstOrDefaultAsync(
            d => d.TenantId == tenantId && d.Id == domainId,
            ct);

    public async Task<IReadOnlyList<StorefrontDomain>> ListByTenantAsync(
        Guid tenantId,
        CancellationToken ct) =>
        await _db.StorefrontDomains.AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.IsPrimary)
            .ThenBy(d => d.Domain)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<StorefrontDomain>> ListTrackedByTenantAsync(
        Guid tenantId,
        CancellationToken ct) =>
        await _db.StorefrontDomains
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.IsPrimary)
            .ThenBy(d => d.Domain)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<StorefrontDomain?> GetVerifiedByHostAsync(string host, CancellationToken ct) =>
        _db.StorefrontDomains.AsNoTracking()
            .FirstOrDefaultAsync(
                d => d.Domain == host && d.VerifiedAt != null,
                ct);

    public Task<bool> DomainExistsAsync(string domain, CancellationToken ct) =>
        _db.StorefrontDomains.AsNoTracking()
            .AnyAsync(d => d.Domain == domain, ct);
}
