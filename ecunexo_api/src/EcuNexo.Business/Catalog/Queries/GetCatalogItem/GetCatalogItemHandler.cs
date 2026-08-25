using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.GetCatalogItem;

public sealed class GetCatalogItemHandler : IQueryHandler<GetCatalogItemQuery, CatalogItemDetailResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly ICategoryRepository _categories;

    public GetCatalogItemHandler(ICatalogItemRepository items, ICategoryRepository categories)
    {
        _items = items;
        _categories = categories;
    }

    public async Task<Result<CatalogItemDetailResponse>> Handle(
        GetCatalogItemQuery query,
        CancellationToken ct)
    {
        var item = await _items.GetActiveByIdAsync(query.TenantId, query.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<CatalogItemDetailResponse>(
                new Error("catalog.item.not_found", "El ítem no existe.", ErrorType.NotFound));
        }

        string? categoryName = null;
        if (item.CategoryId is { } categoryId)
        {
            var category = await _categories.GetActiveByIdAsync(query.TenantId, categoryId, ct)
                .ConfigureAwait(false);
            categoryName = category?.Name;
        }

        return Result.Success(
            new CatalogItemDetailResponse(
                item.Id,
                item.Kind,
                item.Name,
                item.Description,
                item.Sku,
                item.BasePrice,
                item.CategoryId,
                categoryName,
                item.CustomAttributesJson,
                item.Status,
                item.CreatedAt,
                item.UpdatedAt));
    }
}
