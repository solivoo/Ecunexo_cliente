using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Queries.ListCategories;

public sealed record ListCategoriesQuery(Guid TenantId) : IQuery<IReadOnlyList<CategoryListItemResponse>>;

public sealed record CategoryListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? ParentId,
    string AttributeSchemaJson,
    DateTimeOffset CreatedAt);
