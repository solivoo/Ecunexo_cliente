using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListProductTemplates;

public sealed class ListProductTemplatesHandler
    : IQueryHandler<ListProductTemplatesQuery, IReadOnlyList<ProductTemplateResponse>>
{
    private readonly IProductTemplateRepository _templates;
    private readonly ICatalogItemRepository _items;

    public ListProductTemplatesHandler(
        IProductTemplateRepository templates,
        ICatalogItemRepository items)
    {
        _templates = templates;
        _items = items;
    }

    public async Task<Result<IReadOnlyList<ProductTemplateResponse>>> Handle(
        ListProductTemplatesQuery query,
        CancellationToken ct)
    {
        var list = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var usage = await _items.CountItemsByFamilyAsync(query.TenantId, ct).ConfigureAwait(false);

        IReadOnlyList<ProductTemplateResponse> response = list
            .Select(t => new ProductTemplateResponse(
                t.Id,
                t.TenantId,
                t.Name,
                t.Description,
                t.HierarchyTreeJson,
                t.IsActive,
                t.CreatedAt,
                t.UpdatedAt,
                usage.TryGetValue(t.Id, out var count) ? count : 0))
            .ToList();

        return Result.Success(response);
    }
}
