using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.GetProductPrice;

public sealed record GetProductPriceQuery(Guid TenantId, Guid ProductPriceId)
    : IQuery<ProductPriceDetailResponse>;
