using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;

namespace EcuNexo.Business.Ecommerce.Queries.GetEcommerceMetrics;

public sealed record GetEcommerceMetricsQuery(Guid TenantId) : IQuery<EcommerceOrderMetrics>;
