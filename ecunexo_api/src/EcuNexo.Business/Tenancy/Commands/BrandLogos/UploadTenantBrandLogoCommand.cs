using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.BrandLogos;

public sealed record UploadTenantBrandLogoCommand(
    Guid TenantId,
    string OriginalFileName,
    string ContentType,
    byte[] ImageBytes) : ICommand<UploadTenantBrandLogoResponse>;

public sealed record UploadTenantBrandLogoResponse(Guid LogoId, string FileUrl);
