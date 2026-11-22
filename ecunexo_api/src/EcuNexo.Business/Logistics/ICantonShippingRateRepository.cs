using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface ICantonShippingRateRepository
{
    Task<IReadOnlyList<CantonShippingRate>> ListByProvinceAsync(
        Guid tenantId,
        Guid provinceId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default);

    Task<CantonShippingRate?> GetByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default);

    Task<CantonShippingRate?> GetTrackedByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<CantonShippingRate>> ListTrackedByCantonsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> cantonIds,
        Guid? shippingMethodId,
        Guid? originCantonId = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<CantonShippingRate>> ListByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        CancellationToken ct = default);

    Task<Guid?> FindPrimaryOriginCantonIdAsync(
        Guid tenantId,
        CancellationToken ct = default);

    Task AddAsync(CantonShippingRate rate, CancellationToken ct);
}
