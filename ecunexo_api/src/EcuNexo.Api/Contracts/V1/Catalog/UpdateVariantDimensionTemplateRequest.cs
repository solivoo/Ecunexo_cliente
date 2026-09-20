namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record UpdateVariantDimensionTemplateRequest(
    string Name,
    string DimensionType,
    string PredefinedValuesJson);
