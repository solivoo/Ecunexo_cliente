using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Queries.ListProductTemplates;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Queries.GetProductTemplateById;

public sealed class GetProductTemplateByIdHandler
    : IQueryHandler<GetProductTemplateByIdQuery, ProductTemplateResponse>
{
    private readonly IProductTemplateRepository _templates;

    public GetProductTemplateByIdHandler(IProductTemplateRepository templates)
    {
        _templates = templates;
    }

    public async Task<Result<ProductTemplateResponse>> Handle(
        GetProductTemplateByIdQuery query,
        CancellationToken ct)
    {
        var template = await _templates.GetByIdAsync(query.TemplateId, query.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<ProductTemplateResponse>(
                new Error("catalog.product_template.not_found", "La plantilla de producto no existe.", ErrorType.NotFound));
        }

        return Result.Success(new ProductTemplateResponse(
            template.Id,
            template.TenantId,
            template.Name,
            template.Description,
            template.HierarchyTreeJson,
            template.IsActive,
            template.CreatedAt,
            template.UpdatedAt));
    }
}
