using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

public interface ILicenseRedemptionRepository
{
    Task<LicenseRedemption?> GetByIdAsync(Guid grantId, CancellationToken ct);

    Task AddAsync(LicenseRedemption redemption, CancellationToken ct);
}
