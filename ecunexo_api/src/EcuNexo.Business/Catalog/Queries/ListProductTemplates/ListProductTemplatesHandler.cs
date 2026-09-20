using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.ListProductTemplates;

public sealed class ListProductTemplatesHandler
    : IQueryHandler<ListProductTemplatesQuery, IReadOnlyList<ProductTemplateResponse>>
{
    private readonly IProductTemplateRepository _templates;

    public ListProductTemplatesHandler(IProductTemplateRepository templates)
    {
        _templates = templates;
    }

    public async Task<Result<IReadOnlyList<ProductTemplateResponse>>> Handle(
        ListProductTemplatesQuery query,
        CancellationToken ct)
    {
        var list = await _templates.ListByTenantAsync(query.TenantId, ct).ConfigureAwait(false);

        IReadOnlyList<ProductTemplateResponse> response = list
            .Select(t => new ProductTemplateResponse(
                t.Id,
                t.TenantId,
                t.Name,
                t.Description,
                t.HierarchyTreeJson,
                t.IsActive,
                t.CreatedAt,
                t.UpdatedAt))
            .ToList();

        return Result.Success(response);
    }
}
