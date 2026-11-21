using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface ICantonShippingRateRepository
{
    Task<IReadOnlyList<CantonShippingRate>> ListByProvinceAsync(
        Guid tenantId,
        Guid provinceId,
        Guid? shippingMethodId,
        CancellationToken ct);

    Task<CantonShippingRate?> GetByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        CancellationToken ct);

    Task<CantonShippingRate?> GetTrackedByCantonAsync(
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        CancellationToken ct);

    Task<IReadOnlyList<CantonShippingRate>> ListTrackedByCantonsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> cantonIds,
        Guid? shippingMethodId,
        CancellationToken ct);

    Task AddAsync(CantonShippingRate rate, CancellationToken ct);
}
