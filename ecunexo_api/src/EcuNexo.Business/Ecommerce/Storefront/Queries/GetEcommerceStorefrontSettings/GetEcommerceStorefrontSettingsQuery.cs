using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceStorefrontSettings;

public sealed record GetEcommerceStorefrontSettingsQuery(Guid TenantId)
    : IQuery<EcommerceStorefrontSettingsDto>;
