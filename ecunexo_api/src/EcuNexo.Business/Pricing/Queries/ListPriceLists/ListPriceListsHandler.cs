using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ListPriceLists;

public sealed class ListPriceListsHandler
    : IQueryHandler<ListPriceListsQuery, IReadOnlyList<PriceListResponse>>
{
    private readonly IPriceListRepository _priceLists;

    public ListPriceListsHandler(IPriceListRepository priceLists)
    {
        _priceLists = priceLists;
    }

    public async Task<Result<IReadOnlyList<PriceListResponse>>> Handle(
        ListPriceListsQuery query,
        CancellationToken ct)
    {
        var lists = await _priceLists.ListAsync(query.TenantId, query.OnlyActive, ct).ConfigureAwait(false);
        IReadOnlyList<PriceListResponse> response = lists
            .Select(l => new PriceListResponse(
                l.Id,
                l.Code,
                l.Name,
                l.Description,
                l.Currency,
                l.PricesIncludeTax,
                l.ValidFrom,
                l.ValidTo,
                l.Priority,
                l.IsDefault,
                l.IsActive))
            .ToList();

        return Result.Success(response);
    }
}
