using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontColors;

public sealed class ListStorefrontColorsHandler
    : IQueryHandler<ListStorefrontColorsQuery, IReadOnlyList<StorefrontColorDto>>
{
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;

    public ListStorefrontColorsHandler(
        ITenantRepository tenants,
        IVariantDimensionTemplateRepository templates)
    {
        _tenants = tenants;
        _templates = templates;
    }

    public async Task<Result<IReadOnlyList<StorefrontColorDto>>> Handle(
        ListStorefrontColorsQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<IReadOnlyList<StorefrontColorDto>>(tenantError);
        }

        var templates = await _templates
            .ListByTenantAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        return Result.Success(StorefrontColorPalette.FromTemplates(templates));
    }
}
