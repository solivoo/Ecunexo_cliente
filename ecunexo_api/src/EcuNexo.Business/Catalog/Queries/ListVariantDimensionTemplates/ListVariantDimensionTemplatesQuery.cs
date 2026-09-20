using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Queries.ListVariantDimensionTemplates;

public sealed record ListVariantDimensionTemplatesQuery(Guid TenantId)
    : IQuery<IReadOnlyList<VariantDimensionTemplateResponse>>;

public sealed record VariantDimensionTemplateResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    string DimensionType,
    string PredefinedValuesJson,
    bool IsSystemDefault,
    bool IsInUse = false);
