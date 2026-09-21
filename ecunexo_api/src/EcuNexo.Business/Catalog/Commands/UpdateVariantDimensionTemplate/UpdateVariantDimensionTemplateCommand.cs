using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

public sealed record UpdateVariantDimensionTemplateCommand(
    Guid TemplateId,
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson,
    string DataType = VariantDimensionTemplate.DataTypeText,
    bool IsVariantAxis = true,
    string? Unit = null,
    Guid? UpdatedBy = null) : ICommand<UpdateVariantDimensionTemplateResponse>;

public sealed record UpdateVariantDimensionTemplateResponse(
    Guid Id,
    Guid TenantId);
