using EcuNexo.Business.Catalog.Commands.UpdateCategory;

namespace EcuNexo.Api.Contracts.V1.Catalog;

public sealed record UpdateCategoryRequest(
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    string? AttributeSchemaJson = null)
{
    public UpdateCategoryCommand ToCommand(Guid tenantId, Guid categoryId) =>
        new(tenantId, categoryId, Name, Description, ParentId, AttributeSchemaJson);
}
