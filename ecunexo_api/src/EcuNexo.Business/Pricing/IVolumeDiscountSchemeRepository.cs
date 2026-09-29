using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public interface IVolumeDiscountSchemeRepository
{
    Task AddAsync(VolumeDiscountScheme scheme, CancellationToken ct);

    Task<VolumeDiscountScheme?> GetByIdAsync(Guid tenantId, Guid schemeId, CancellationToken ct);

    Task<VolumeDiscountScheme?> GetTrackedByIdAsync(Guid tenantId, Guid schemeId, CancellationToken ct);

    Task<IReadOnlyList<VolumeDiscountScheme>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct);

    Task<bool> NameExistsAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);
}
