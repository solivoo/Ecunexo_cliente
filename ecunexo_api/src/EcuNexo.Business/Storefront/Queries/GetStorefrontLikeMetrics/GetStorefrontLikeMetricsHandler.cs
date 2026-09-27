using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontLikeMetrics;

public sealed class GetStorefrontLikeMetricsHandler
    : IQueryHandler<GetStorefrontLikeMetricsQuery, StorefrontLikeMetricsDto>
{
    public const int DefaultDays = 30;
    public const int MaxDays = 365;
    public const int TopProducts = 5;

    private readonly IStorefrontProductLikeRepository _likes;

    public GetStorefrontLikeMetricsHandler(IStorefrontProductLikeRepository likes)
    {
        _likes = likes;
    }

    public async Task<Result<StorefrontLikeMetricsDto>> Handle(
        GetStorefrontLikeMetricsQuery query,
        CancellationToken ct)
    {
        var days = Math.Clamp(query.Days, 1, MaxDays);
        var now = DateTimeOffset.UtcNow;
        var firstDayUtc = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero)
            .AddDays(-(days - 1));

        var metrics = await _likes
            .ListMetricsAsync(query.TenantId, firstDayUtc, now, TopProducts, ct)
            .ConfigureAwait(false);

        return Result.Success(metrics);
    }
}
