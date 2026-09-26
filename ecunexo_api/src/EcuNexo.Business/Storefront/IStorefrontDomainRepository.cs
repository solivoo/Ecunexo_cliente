using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Storefront;

public interface IStorefrontDomainRepository
{
    Task AddAsync(StorefrontDomain domain, CancellationToken ct);

    void Remove(StorefrontDomain domain);

    Task<StorefrontDomain?> GetTrackedByIdAsync(Guid tenantId, Guid domainId, CancellationToken ct);

    Task<IReadOnlyList<StorefrontDomain>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<IReadOnlyList<StorefrontDomain>> ListTrackedByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<StorefrontDomain?> GetVerifiedByHostAsync(string host, CancellationToken ct);

    Task<bool> DomainExistsAsync(string domain, CancellationToken ct);
}
