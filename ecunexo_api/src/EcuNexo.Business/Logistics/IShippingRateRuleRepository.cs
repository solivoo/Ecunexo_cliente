using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics;

public interface IShippingRateRuleRepository
{
    Task AddAsync(ShippingRateRule rule, CancellationToken ct);

    Task<ShippingRateRule?> GetByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct);

    Task<ShippingRateRule?> GetTrackedByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct);

    Task<IReadOnlyList<ShippingRateRule>> ListAsync(
        Guid tenantId,
        string? carrier,
        string? zone,
        bool onlyActive,
        CancellationToken ct);

    Task<IReadOnlyList<ShippingRateRule>> ListActiveForResolutionAsync(
        Guid tenantId,
        string? zone,
        CancellationToken ct);

    void Remove(ShippingRateRule rule);
}
