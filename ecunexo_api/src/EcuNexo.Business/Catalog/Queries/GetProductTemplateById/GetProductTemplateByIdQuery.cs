using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Queries.ListProductTemplates;

namespace EcuNexo.Business.Catalog.Queries.GetProductTemplateById;

public sealed record GetProductTemplateByIdQuery(Guid TemplateId, Guid TenantId)
    : IQuery<ProductTemplateResponse>;
