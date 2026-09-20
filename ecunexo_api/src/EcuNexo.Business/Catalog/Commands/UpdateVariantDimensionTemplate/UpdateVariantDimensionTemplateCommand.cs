using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

public sealed record UpdateVariantDimensionTemplateCommand(
    Guid TemplateId,
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson,
    Guid? UpdatedBy = null) : ICommand<UpdateVariantDimensionTemplateResponse>;

public sealed record UpdateVariantDimensionTemplateResponse(
    Guid Id,
    Guid TenantId);
