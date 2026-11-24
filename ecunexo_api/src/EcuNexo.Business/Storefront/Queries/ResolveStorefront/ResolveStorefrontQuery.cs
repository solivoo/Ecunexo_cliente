using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront;

namespace EcuNexo.Business.Storefront.Queries.ResolveStorefront;

public sealed record ResolveStorefrontQuery(string Host) : IQuery<StorefrontResolveResponse>;

public sealed record StorefrontResolveResponse(
    Guid TenantId,
    string Name,
    string? LogoUrl,
    string? PrimaryColorHex,
    string Locale,
    string Currency,
    StorefrontSocialLinks? SocialLinks = null);
