using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.UpdateCategory;

public sealed record UpdateCategoryCommand(
    Guid TenantId,
    Guid CategoryId,
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    string? AttributeSchemaJson = null) : ICommand<UpdateCategoryResponse>;

public sealed record UpdateCategoryResponse(Guid CategoryId, Guid TenantId);
