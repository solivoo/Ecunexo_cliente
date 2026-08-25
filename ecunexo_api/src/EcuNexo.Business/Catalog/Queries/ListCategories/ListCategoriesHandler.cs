using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListCategories;

public sealed class ListCategoriesHandler
    : IQueryHandler<ListCategoriesQuery, IReadOnlyList<CategoryListItemResponse>>
{
    private readonly ICategoryRepository _categories;

    public ListCategoriesHandler(ICategoryRepository categories)
    {
        _categories = categories;
    }

    public async Task<Result<IReadOnlyList<CategoryListItemResponse>>> Handle(
        ListCategoriesQuery query,
        CancellationToken ct)
    {
        var list = await _categories.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        IReadOnlyList<CategoryListItemResponse> items = list
            .Select(c => new CategoryListItemResponse(
                c.Id,
                c.Name,
                c.Description,
                c.ParentId,
                c.AttributeSchemaJson,
                c.CreatedAt))
            .ToList();
        return Result.Success(items);
    }
}
