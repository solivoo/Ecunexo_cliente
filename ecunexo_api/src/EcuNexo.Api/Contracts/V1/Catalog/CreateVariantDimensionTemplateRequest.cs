namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record CreateVariantDimensionTemplateRequest(
    string Name,
    string DimensionType,
    string? PredefinedValuesJson = null,
    string DataType = "text",
    bool IsVariantAxis = true,
    string? Unit = null);
