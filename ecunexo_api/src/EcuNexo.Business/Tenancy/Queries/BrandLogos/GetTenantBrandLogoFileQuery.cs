using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Queries.BrandLogos;

public sealed record GetTenantBrandLogoFileQuery(Guid TenantId, Guid LogoId)
    : IQuery<TenantBrandLogoFileResponse>;

public sealed record TenantBrandLogoFileResponse(
    string ContentType,
    string FileName,
    byte[] Bytes);
