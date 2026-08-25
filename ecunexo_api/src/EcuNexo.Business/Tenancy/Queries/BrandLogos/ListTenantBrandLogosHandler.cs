using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.BrandLogos;

public sealed class ListTenantBrandLogosHandler
    : IQueryHandler<ListTenantBrandLogosQuery, TenantBrandLogoCatalogResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly ITenantBrandLogoRepository _logos;

    public ListTenantBrandLogosHandler(ITenantRepository tenants, ITenantBrandLogoRepository logos)
    {
        _tenants = tenants;
        _logos = logos;
    }

    public async Task<Result<TenantBrandLogoCatalogResponse>> Handle(
        ListTenantBrandLogosQuery query,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<TenantBrandLogoCatalogResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        var rows = await _logos.ListMetaByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var items = rows
            .Select(x => new TenantBrandLogoListItemResponse(
                x.Id,
                x.OriginalFileName,
                x.Extension,
                x.ContentType,
                x.ByteSize,
                x.CreatedAt,
                $"/api/v1/tenants/{query.TenantId}/brand-logos/{x.Id}/file"))
            .ToList();

        return Result.Success(
            new TenantBrandLogoCatalogResponse(
                tenant.LogoLightId,
                tenant.LogoDarkId,
                tenant.PreferWordmark,
                items));
    }
}
