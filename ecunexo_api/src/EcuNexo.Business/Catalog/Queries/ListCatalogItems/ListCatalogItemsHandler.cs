using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListCatalogItems;

public sealed class ListCatalogItemsHandler
    : IQueryHandler<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>
{
    private readonly ICatalogItemRepository _items;
    private readonly ICategoryRepository _categories;

    public ListCatalogItemsHandler(ICatalogItemRepository items, ICategoryRepository categories)
    {
        _items = items;
        _categories = categories;
    }

    public async Task<Result<IReadOnlyList<CatalogItemListItemResponse>>> Handle(
        ListCatalogItemsQuery query,
        CancellationToken ct)
    {
        var list = await _items.ListActiveByTenantAsync(query.TenantId, query.Kind, query.Status, ct).ConfigureAwait(false);
        var categories = await _categories.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var names = categories.ToDictionary(c => c.Id, c => c.Name);

        IReadOnlyList<CatalogItemListItemResponse> items = list
            .Select(i => new CatalogItemListItemResponse(
                i.Id,
                i.Kind,
                i.Name,
                i.Description,
                i.Sku,
                i.BasePrice,
                i.CategoryId,
                i.CategoryId is { } cid && names.TryGetValue(cid, out var n) ? n : null,
                i.Status,
                i.CreatedAt))
            .ToList();
        return Result.Success(items);
    }
}
