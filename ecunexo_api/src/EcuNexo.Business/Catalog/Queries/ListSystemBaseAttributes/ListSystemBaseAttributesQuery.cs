using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Queries.ListSystemBaseAttributes;

public sealed record ListSystemBaseAttributesQuery(Guid TenantId)
    : IQuery<ListSystemBaseAttributesResponse>;

public sealed record UnitOfMeasureOptionResponse(string Value, string Label);

public sealed record SystemBaseAttributeResponse(
    string Id,
    string Name,
    string DimensionType,
    string DataType,
    IReadOnlyList<string> PredefinedValues,
    string? Unit,
    bool IsVariantAxis,
    string SystemRole,
    string Description,
    IReadOnlyList<string> Aliases);

public sealed record ListSystemBaseAttributesResponse(
    IReadOnlyList<SystemBaseAttributeResponse> Attributes,
    IReadOnlyList<UnitOfMeasureOptionResponse> UnitOfMeasureOptions);
