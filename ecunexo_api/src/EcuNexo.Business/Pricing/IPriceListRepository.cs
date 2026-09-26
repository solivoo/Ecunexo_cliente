using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public interface IPriceListRepository
{
    Task AddAsync(PriceList list, CancellationToken ct);

    Task<PriceList?> GetByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct);

    Task<PriceList?> GetTrackedByIdAsync(Guid tenantId, Guid priceListId, CancellationToken ct);

    Task<PriceList?> GetDefaultAsync(Guid tenantId, CancellationToken ct);

    Task<PriceList?> GetDefaultTrackedAsync(Guid tenantId, CancellationToken ct);

    Task<IReadOnlyList<PriceList>> ListAsync(Guid tenantId, bool onlyActive, CancellationToken ct);

    Task<bool> CodeExistsAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);
}
