using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceCheckoutOptions;

public sealed record GetEcommerceCheckoutOptionsQuery(Guid TenantId)
    : IQuery<EcommerceCheckoutOptionsDto>;
