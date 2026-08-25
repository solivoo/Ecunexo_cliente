using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.BrandLogos;

public sealed class GetTenantBrandLogoFileHandler
    : IQueryHandler<GetTenantBrandLogoFileQuery, TenantBrandLogoFileResponse>
{
    private readonly ITenantBrandLogoRepository _logos;

    public GetTenantBrandLogoFileHandler(ITenantBrandLogoRepository logos)
    {
        _logos = logos;
    }

    public async Task<Result<TenantBrandLogoFileResponse>> Handle(
        GetTenantBrandLogoFileQuery query,
        CancellationToken ct)
    {
        var logo = await _logos.GetByIdAsync(query.TenantId, query.LogoId, ct).ConfigureAwait(false);
        if (logo is null)
        {
            return Result.Failure<TenantBrandLogoFileResponse>(
                new Error("brand_logo.not_found", "El logo no existe.", ErrorType.NotFound));
        }

        return Result.Success(
            new TenantBrandLogoFileResponse(
                logo.ContentType,
                $"{Path.GetFileNameWithoutExtension(logo.OriginalFileName)}.{logo.Extension}",
                logo.ImageBytes));
    }
}
