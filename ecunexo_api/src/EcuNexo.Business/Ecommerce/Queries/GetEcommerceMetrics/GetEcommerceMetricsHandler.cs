using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceMetrics;

public sealed class GetEcommerceMetricsHandler
    : IQueryHandler<GetEcommerceMetricsQuery, EcommerceOrderMetrics>
{
    private readonly IEcommerceOrderRepository _orders;

    public GetEcommerceMetricsHandler(IEcommerceOrderRepository orders)
    {
        _orders = orders;
    }

    public async Task<Result<EcommerceOrderMetrics>> Handle(
        GetEcommerceMetricsQuery query,
        CancellationToken ct)
    {
        var metrics = await _orders.GetMetricsAsync(query.TenantId, ct).ConfigureAwait(false);
        return metrics;
    }
}
