using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontCategories;

public sealed class ListStorefrontCategoriesHandler
    : IQueryHandler<ListStorefrontCategoriesQuery, IReadOnlyList<StorefrontCategoryDto>>
{
    private readonly ICategoryRepository _categories;
    private readonly ITenantRepository _tenants;

    public ListStorefrontCategoriesHandler(
        ICategoryRepository categories,
        ITenantRepository tenants)
    {
        _categories = categories;
        _tenants = tenants;
    }

    public async Task<Result<IReadOnlyList<StorefrontCategoryDto>>> Handle(
        ListStorefrontCategoriesQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<IReadOnlyList<StorefrontCategoryDto>>(tenantError);
        }

        var categories = await _categories
            .ListActiveByTenantAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        IReadOnlyList<StorefrontCategoryDto> dtos = categories
            .OrderBy(c => c.Name)
            .Select(c => new StorefrontCategoryDto(c.Id, c.Name, c.Description, c.ParentId))
            .ToList();

        return Result.Success(dtos);
    }
}
