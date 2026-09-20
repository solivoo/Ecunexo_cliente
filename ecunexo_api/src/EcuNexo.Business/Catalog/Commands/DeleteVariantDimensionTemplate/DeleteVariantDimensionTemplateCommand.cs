using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.DeleteVariantDimensionTemplate;

public sealed record DeleteVariantDimensionTemplateCommand(
    Guid TemplateId,
    Guid TenantId) : ICommand<DeleteVariantDimensionTemplateResponse>;

public sealed record DeleteVariantDimensionTemplateResponse(
    Guid TemplateId,
    Guid TenantId);
