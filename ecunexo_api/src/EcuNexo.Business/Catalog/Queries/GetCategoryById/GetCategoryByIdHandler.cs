using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Queries.ListCategories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.GetCategoryById;

public sealed class GetCategoryByIdHandler
    : IQueryHandler<GetCategoryByIdQuery, CategoryListItemResponse>
{
    private readonly ICategoryRepository _categories;

    public GetCategoryByIdHandler(ICategoryRepository categories)
    {
        _categories = categories;
    }

    public async Task<Result<CategoryListItemResponse>> Handle(
        GetCategoryByIdQuery query,
        CancellationToken ct)
    {
        var category = await _categories
            .GetActiveByIdAsync(query.TenantId, query.CategoryId, ct)
            .ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<CategoryListItemResponse>(
                new Error("catalog.category.not_found", "La categoría no existe.", ErrorType.NotFound));
        }

        return Result.Success(new CategoryListItemResponse(
            category.Id,
            category.Name,
            category.Description,
            category.ParentId,
            category.CreatedAt,
            category.UpdatedAt));
    }
}
