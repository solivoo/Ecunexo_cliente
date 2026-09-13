using EcuNexo.Business.Tenancy.Certificates;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class TenantSigningCertificateRepository : ITenantSigningCertificateRepository
{
    private readonly EcuNexoDbContext _db;

    public TenantSigningCertificateRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task<TenantSigningCertificate?> GetActiveByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return _db.TenantSigningCertificates
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task AddAsync(TenantSigningCertificate certificate, CancellationToken cancellationToken = default)
    {
        _db.TenantSigningCertificates.Add(certificate);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(TenantSigningCertificate certificate, CancellationToken cancellationToken = default)
    {
        _db.TenantSigningCertificates.Update(certificate);
        return Task.CompletedTask;
    }
}
