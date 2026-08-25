using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class LicenseRedemptionRepository(EcuNexoDbContext db) : ILicenseRedemptionRepository
{
    public Task<LicenseRedemption?> GetByIdAsync(Guid grantId, CancellationToken ct) =>
        db.Set<LicenseRedemption>().AsNoTracking().FirstOrDefaultAsync(r => r.Id == grantId, ct);

    public async Task AddAsync(LicenseRedemption redemption, CancellationToken ct) =>
        await db.Set<LicenseRedemption>().AddAsync(redemption, ct).ConfigureAwait(false);
}
