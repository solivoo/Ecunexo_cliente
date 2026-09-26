using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Storefront.Queries.ResolveStorefront;

public sealed record ResolveStorefrontQuery(string Host) : IQuery<StorefrontResolveResponse>;

public sealed record StorefrontResolveResponse(
    Guid TenantId,
    string Name,
    string? LogoUrl,
    string? PrimaryColorHex,
    string Locale,
    string Currency);
