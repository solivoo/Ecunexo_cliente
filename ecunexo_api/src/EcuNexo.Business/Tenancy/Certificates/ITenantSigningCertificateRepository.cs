using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Certificates;

public interface ITenantSigningCertificateRepository
{
    Task<TenantSigningCertificate?> GetActiveByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task AddAsync(TenantSigningCertificate certificate, CancellationToken cancellationToken = default);
    Task UpdateAsync(TenantSigningCertificate certificate, CancellationToken cancellationToken = default);
}
