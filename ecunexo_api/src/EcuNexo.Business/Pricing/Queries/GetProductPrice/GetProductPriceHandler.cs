using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.GetProductPrice;

public sealed class GetProductPriceHandler
    : IQueryHandler<GetProductPriceQuery, ProductPriceDetailResponse>
{
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceListRepository _priceLists;
    private readonly ICatalogItemRepository _items;

    public GetProductPriceHandler(
        IProductPriceRepository productPrices,
        IPriceListRepository priceLists,
        ICatalogItemRepository items)
    {
        _productPrices = productPrices;
        _priceLists = priceLists;
        _items = items;
    }

    public async Task<Result<ProductPriceDetailResponse>> Handle(
        GetProductPriceQuery query,
        CancellationToken ct)
    {
        var price = await _productPrices.GetByIdAsync(query.TenantId, query.ProductPriceId, ct)
            .ConfigureAwait(false);
        if (price is null)
        {
            return Result.Failure<ProductPriceDetailResponse>(
                new Error("catalog.pricing.product_price.not_found", "El precio no existe.", ErrorType.NotFound));
        }

        var list = await _priceLists.GetByIdAsync(query.TenantId, price.PriceListId, ct).ConfigureAwait(false);

        var item = await _items.GetActiveByIdAsync(query.TenantId, price.CatalogItemId, ct).ConfigureAwait(false);

        var response = new ProductPriceDetailResponse(
            price.Id,
            price.CatalogItemId,
            item?.Name ?? string.Empty,
            item?.Sku,
            price.PriceListId,
            list?.Code ?? string.Empty,
            list?.Name ?? string.Empty,
            price.Price,
            price.ValidFrom,
            price.ValidTo,
            price.IsActive,
            price.Tiers
                .Select(t => new PriceTierResponse(t.QuantityFrom, t.QuantityTo, t.UnitPrice, t.IsActive))
                .ToList());

        return Result.Success(response);
    }
}
