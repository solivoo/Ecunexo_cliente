using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

/// <summary>Renombrado explícito de una opción predefinida dentro del atributo.</summary>
public sealed record VariantValueRename(string From, string To);

public sealed record UpdateVariantDimensionTemplateCommand(
    Guid TemplateId,
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson,
    string DataType = VariantDimensionTemplate.DataTypeText,
    bool IsVariantAxis = true,
    string? Unit = null,
    Guid? UpdatedBy = null,
    IReadOnlyList<VariantValueRename>? ValueRenames = null) : ICommand<UpdateVariantDimensionTemplateResponse>;

public sealed record UpdateVariantDimensionTemplateResponse(
    Guid Id,
    Guid TenantId,
    int RenamedItems = 0);
