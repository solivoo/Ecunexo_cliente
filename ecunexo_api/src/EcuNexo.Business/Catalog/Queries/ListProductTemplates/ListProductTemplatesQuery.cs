using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Queries.ListProductTemplates;

public sealed record ListProductTemplatesQuery(Guid TenantId)
    : IQuery<IReadOnlyList<ProductTemplateResponse>>;

public sealed record ProductTemplateResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    string? Description,
    string HierarchyTreeJson,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    int UsageCount = 0);
