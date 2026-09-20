using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.CreateVariantDimensionTemplate;

public sealed record CreateVariantDimensionTemplateCommand(
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson) : ICommand<CreateVariantDimensionTemplateResponse>;

public sealed record CreateVariantDimensionTemplateResponse(Guid Id, Guid TenantId);
