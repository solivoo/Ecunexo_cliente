using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;

public sealed record GetStorefrontProductQuery(Guid TenantId, Guid ProductId)
    : IQuery<StorefrontProductDetailDto>;
