using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.GetPriceHistory;

public sealed class GetPriceHistoryHandler
    : IQueryHandler<GetPriceHistoryQuery, IReadOnlyList<PriceHistoryItemResponse>>
{
    private readonly IPriceChangeLogRepository _history;

    public GetPriceHistoryHandler(IPriceChangeLogRepository history)
    {
        _history = history;
    }

    public async Task<Result<IReadOnlyList<PriceHistoryItemResponse>>> Handle(
        GetPriceHistoryQuery query,
        CancellationToken ct)
    {
        var entries = await _history
            .ListAsync(query.TenantId, query.CatalogItemId, query.PriceListId, query.From, query.To, ct)
            .ConfigureAwait(false);

        IReadOnlyList<PriceHistoryItemResponse> response = entries
            .Select(e => new PriceHistoryItemResponse(
                e.Id,
                e.CatalogItemId,
                e.ItemName,
                e.Sku,
                e.PriceListId,
                e.PriceListCode,
                e.PriceListName,
                e.PreviousPrice,
                e.NewPrice,
                e.ValidFrom,
                e.ValidTo,
                e.Reason,
                e.ChangedBy,
                e.ChangedAt))
            .ToList();

        return Result.Success(response);
    }
}
