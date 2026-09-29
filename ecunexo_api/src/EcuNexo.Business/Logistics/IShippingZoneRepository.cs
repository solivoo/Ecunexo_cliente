using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface IShippingZoneRepository
{
    Task AddAsync(ShippingZone zone, CancellationToken ct);

    Task<ShippingZone?> GetByIdAsync(Guid tenantId, Guid zoneId, CancellationToken ct);

    Task<ShippingZone?> GetTrackedByIdAsync(Guid tenantId, Guid zoneId, CancellationToken ct);

    Task<ShippingZone?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct);

    Task<bool> ExistsCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);

    Task<IReadOnlyList<ShippingZone>> ListAsync(
        Guid tenantId,
        bool onlyActive,
        CancellationToken ct);

    void Remove(ShippingZone zone);
}
