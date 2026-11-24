using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.GetProductPriceMatrix;

public sealed class GetProductPriceMatrixHandler
    : IQueryHandler<GetProductPriceMatrixQuery, ProductPriceMatrixPageResponse>
{
    public const int MaxPageSize = 200;

    private readonly IProductPriceRepository _productPrices;

    public GetProductPriceMatrixHandler(IProductPriceRepository productPrices)
    {
        _productPrices = productPrices;
    }

    public async Task<Result<ProductPriceMatrixPageResponse>> Handle(
        GetProductPriceMatrixQuery query,
        CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);
        var date = query.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var result = await _productPrices
            .GetMatrixPageAsync(
                new ProductPriceMatrixFilter(
                    query.TenantId,
                    page,
                    pageSize,
                    query.Search,
                    query.OnlyMissing,
                    query.PriceListIds,
                    date),
                ct)
            .ConfigureAwait(false);

        return Result.Success(result);
    }
}
