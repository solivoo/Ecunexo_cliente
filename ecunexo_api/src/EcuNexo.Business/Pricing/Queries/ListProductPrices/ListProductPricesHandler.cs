using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ListProductPrices;

public sealed class ListProductPricesHandler
    : IQueryHandler<ListProductPricesQuery, IReadOnlyList<ProductPriceListItemResponse>>
{
    private readonly IProductPriceRepository _productPrices;

    public ListProductPricesHandler(IProductPriceRepository productPrices)
    {
        _productPrices = productPrices;
    }

    public async Task<Result<IReadOnlyList<ProductPriceListItemResponse>>> Handle(
        ListProductPricesQuery query,
        CancellationToken ct)
    {
        var filter = new ProductPriceFilter(
            query.TenantId,
            query.Search,
            query.PriceListId,
            query.Date,
            query.OnlyVigent);

        var rows = await _productPrices.ListAsync(filter, ct).ConfigureAwait(false);
        IReadOnlyList<ProductPriceListItemResponse> response = rows
            .Select(r => new ProductPriceListItemResponse(
                r.Id,
                r.CatalogItemId,
                r.ItemName,
                r.Sku,
                r.PriceListId,
                r.PriceListCode,
                r.PriceListName,
                r.Price,
                r.ValidFrom,
                r.ValidTo,
                r.IsActive))
            .ToList();

        return Result.Success(response);
    }
}
