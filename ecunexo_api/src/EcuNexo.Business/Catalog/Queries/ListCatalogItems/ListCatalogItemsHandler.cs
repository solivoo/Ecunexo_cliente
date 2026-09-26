using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListCatalogItems;

public sealed class ListCatalogItemsHandler
    : IQueryHandler<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>
{
    private readonly ICatalogItemRepository _items;
    private readonly IProductTemplateRepository _templates;

    public ListCatalogItemsHandler(
        ICatalogItemRepository items,
        IProductTemplateRepository templates)
    {
        _items = items;
        _templates = templates;
    }

    public async Task<Result<IReadOnlyList<CatalogItemListItemResponse>>> Handle(
        ListCatalogItemsQuery query,
        CancellationToken ct)
    {
        var list = await _items.ListActiveByTenantAsync(query.TenantId, query.Kind, query.Status, ct).ConfigureAwait(false);
        if (query.OnlyRoots)
        {
            list = list.Where(i => i.ParentId == null).ToList();
        }

        Dictionary<Guid, string> familyNames = [];
        if (list.Any(i => i.FamilyId.HasValue))
        {
            var templates = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
            familyNames = templates.ToDictionary(t => t.Id, t => t.Name);
        }

        IReadOnlyList<CatalogItemListItemResponse> items = list
            .Select(i =>
            {
                var mainImg = i.Images.FirstOrDefault(img => img.IsMain) ?? i.Images.FirstOrDefault();
                return new CatalogItemListItemResponse(
                    i.Id,
                    i.Kind,
                    i.Name,
                    i.Description,
                    i.Sku,
                    i.BasePrice,
                    i.Status,
                    i.CreatedAt,
                    mainImg?.ThumbUrl,
                    mainImg?.MediumUrl,
                    i.IsMatrixParent,
                    i.ParentId,
                    i.Variants.Count,
                    i.VariantDimensionsJson,
                    i.FamilyId,
                    i.FamilyId is { } fid && familyNames.TryGetValue(fid, out var fn) ? fn : null,
                    i.HierarchyPathJson,
                    i.CustomAttributesJson);
            })
            .ToList();
        return Result.Success(items);
    }
}
