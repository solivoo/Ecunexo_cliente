using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListVariantDimensionTemplates;

public sealed class ListVariantDimensionTemplatesHandler
    : IQueryHandler<ListVariantDimensionTemplatesQuery, IReadOnlyList<VariantDimensionTemplateResponse>>
{
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly ICatalogItemRepository _items;

    public ListVariantDimensionTemplatesHandler(
        IVariantDimensionTemplateRepository templates,
        ICatalogItemRepository items)
    {
        _templates = templates;
        _items = items;
    }

    public async Task<Result<IReadOnlyList<VariantDimensionTemplateResponse>>> Handle(
        ListVariantDimensionTemplatesQuery query,
        CancellationToken ct)
    {
        var list = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        var inUseNames = await _items.GetInUseAttributeTemplateNamesAsync(query.TenantId, ct).ConfigureAwait(false);

        IReadOnlyList<VariantDimensionTemplateResponse> response = list
            .Select(t => new VariantDimensionTemplateResponse(
                t.Id,
                t.TenantId,
                t.Name,
                t.DimensionType,
                t.PredefinedValuesJson,
                t.IsSystemDefault,
                inUseNames.Contains(t.Name)))
            .ToList();

        return Result.Success(response);
    }
}
