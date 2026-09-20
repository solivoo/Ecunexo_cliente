using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListVariantDimensionTemplates;

public sealed class ListVariantDimensionTemplatesHandler
    : IQueryHandler<ListVariantDimensionTemplatesQuery, IReadOnlyList<VariantDimensionTemplateResponse>>
{
    private readonly IVariantDimensionTemplateRepository _templates;

    public ListVariantDimensionTemplatesHandler(IVariantDimensionTemplateRepository templates)
    {
        _templates = templates;
    }

    public async Task<Result<IReadOnlyList<VariantDimensionTemplateResponse>>> Handle(
        ListVariantDimensionTemplatesQuery query,
        CancellationToken ct)
    {
        var list = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);

        IReadOnlyList<VariantDimensionTemplateResponse> response = list
            .Select(t => new VariantDimensionTemplateResponse(
                t.Id,
                t.TenantId,
                t.Name,
                t.DimensionType,
                t.PredefinedValuesJson,
                t.IsSystemDefault))
            .ToList();

        return Result.Success(response);
    }
}
