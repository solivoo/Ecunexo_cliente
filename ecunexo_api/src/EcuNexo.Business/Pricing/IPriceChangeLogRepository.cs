using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public interface IPriceChangeLogRepository
{
    Task AddAsync(PriceChangeLog log, CancellationToken ct);

    Task<IReadOnlyList<PriceHistoryRow>> ListAsync(
        Guid tenantId,
        Guid? catalogItemId,
        Guid? priceListId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct);
}
