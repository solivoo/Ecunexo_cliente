using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontLikeMetrics;

public sealed record GetStorefrontLikeMetricsQuery(
    Guid TenantId,
    int Days = 30) : IQuery<StorefrontLikeMetricsDto>;
