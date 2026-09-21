using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.CreateVariantDimensionTemplate;

public sealed record CreateVariantDimensionTemplateCommand(
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson,
    string DataType = VariantDimensionTemplate.DataTypeText,
    bool IsVariantAxis = true,
    string? Unit = null) : ICommand<CreateVariantDimensionTemplateResponse>;

public sealed record CreateVariantDimensionTemplateResponse(Guid Id, Guid TenantId);
