namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record UpdateProductTemplateRequest(
    string Name,
    string? Description,
    string HierarchyTreeJson,
    bool IsActive = true);
