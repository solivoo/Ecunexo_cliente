using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface IShippingMethodRepository
{
    Task AddAsync(ShippingMethod method, CancellationToken ct);

    Task<ShippingMethod?> GetByIdAsync(Guid tenantId, Guid methodId, CancellationToken ct);

    Task<ShippingMethod?> GetTrackedByIdAsync(Guid tenantId, Guid methodId, CancellationToken ct);

    Task<ShippingMethod?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct);

    Task<bool> ExistsCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);

    Task<IReadOnlyList<ShippingMethod>> ListAsync(
        Guid tenantId,
        bool onlyActive,
        CancellationToken ct);

    void Remove(ShippingMethod method);
}
