using EcuNexo.Business.Catalog.Commands.CreateCategory;

namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record CreateCategoryRequest(
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    string? AttributeSchemaJson = null)
{
    public CreateCategoryCommand ToCommand(Guid tenantId) =>
        new(tenantId, Name, Description, ParentId, AttributeSchemaJson);
}
