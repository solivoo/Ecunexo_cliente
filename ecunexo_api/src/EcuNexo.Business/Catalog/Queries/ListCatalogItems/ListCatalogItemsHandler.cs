using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListCatalogItems;

public sealed class ListCatalogItemsHandler
    : IQueryHandler<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>
{
    private readonly ICatalogItemRepository _items;
    private readonly IProductTemplateRepository _templates;
    private readonly ICategoryRepository? _categories;

    public ListCatalogItemsHandler(
        ICatalogItemRepository items,
        IProductTemplateRepository templates,
        ICategoryRepository? categories = null)
    {
        _items = items;
        _templates = templates;
        _categories = categories;
    }

    public async Task<Result<IReadOnlyList<CatalogItemListItemResponse>>> Handle(
        ListCatalogItemsQuery query,
        CancellationToken ct)
    {
        var list = await _items.ListActiveByTenantAsync(query.TenantId, query.Kind, query.Status, ct).ConfigureAwait(false);
        var itemsById = list.ToDictionary(i => i.Id);
        var variantsByParentId = list
            .Where(i => i.ParentId != null)
            .GroupBy(i => i.ParentId!.Value)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<CatalogItem>)g
                    .OrderBy(v => v.SortOrder)
                    .ThenBy(v => v.CreatedAt)
                    .ToList());
        var parentNames = list
            .Where(i => i.ParentId == null)
            .ToDictionary(i => i.Id, i => i.Name);

        if (query.OnlyRoots)
        {
            list = list.Where(i => i.ParentId == null).ToList();
        }

        if (!query.IncludeParents)
        {
            list = list.Where(i => !i.IsMatrixParent).ToList();
        }

        Dictionary<Guid, string> familyNames = [];
        if (list.Any(i => i.FamilyId.HasValue))
        {
            var templates = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
            familyNames = templates.ToDictionary(t => t.Id, t => t.Name);
        }

        Dictionary<Guid, string> categoryNames = [];
        if (_categories is not null && list.Any(i => i.CategoryId.HasValue))
        {
            var categories = await _categories.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
            categoryNames = categories.ToDictionary(c => c.Id, c => c.Name);
        }

        IReadOnlyList<CatalogItemListItemResponse> items = list
            .Select(i =>
            {
                var thumbUrl = i.ResolvedThumbUrl;
                var mediumUrl = i.ResolvedMediumUrl;

                if (thumbUrl is null)
                {
                    CatalogItemImage? fallback = null;
                    if (i.IsMatrixParent)
                    {
                        fallback = CatalogItemThumbnailResolver.ResolveParentOrStandaloneImage(
                            i,
                            variantsByParentId.GetValueOrDefault(i.Id));
                    }
                    else if (i.ParentId is { } parentId && itemsById.TryGetValue(parentId, out var parentItem))
                    {
                        fallback = CatalogItemThumbnailResolver.ResolveVariantImage(i, parentItem);
                    }
                    else
                    {
                        fallback = CatalogItemThumbnailResolver.ResolveParentOrStandaloneImage(i);
                    }

                    thumbUrl = fallback?.ThumbUrl;
                    mediumUrl = fallback?.MediumUrl;
                }

                return new CatalogItemListItemResponse(
                    i.Id,
                    i.Kind,
                    i.Name,
                    i.Description,
                    i.Sku,
                    i.BasePrice,
                    i.Status,
                    i.CreatedAt,
                    thumbUrl,
                    mediumUrl,
                    i.IsMatrixParent,
                    i.ParentId,
                    i.Variants.Count,
                    i.VariantDimensionsJson,
                    i.FamilyId,
                    i.FamilyId is { } fid && familyNames.TryGetValue(fid, out var fn) ? fn : null,
                    i.HierarchyPathJson,
                    i.CustomAttributesJson,
                    i.IsHiddenFromStorefront,
                    i.ParentId is { } pid && parentNames.TryGetValue(pid, out var parentName) ? parentName : null,
                    i.MinOrderQuantity,
                    i.CostPrice,
                    i.CategoryId,
                    i.CategoryId is { } cid && categoryNames.TryGetValue(cid, out var cn) ? cn : null);
            })
            .ToList();
        return Result.Success(items);
    }
}
