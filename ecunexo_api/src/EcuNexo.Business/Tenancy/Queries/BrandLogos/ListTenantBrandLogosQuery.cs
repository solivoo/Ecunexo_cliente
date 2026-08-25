using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Queries.BrandLogos;

public sealed record ListTenantBrandLogosQuery(Guid TenantId) : IQuery<TenantBrandLogoCatalogResponse>;

public sealed record TenantBrandLogoCatalogResponse(
    Guid? LightLogoId,
    Guid? DarkLogoId,
    bool PreferWordmark,
    IReadOnlyList<TenantBrandLogoListItemResponse> Items);

public sealed record TenantBrandLogoListItemResponse(
    Guid Id,
    string OriginalFileName,
    string Extension,
    string ContentType,
    int ByteSize,
    DateTimeOffset CreatedAt,
    string FileUrl);
