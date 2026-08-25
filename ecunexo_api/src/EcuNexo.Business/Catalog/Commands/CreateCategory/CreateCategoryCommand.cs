using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.CreateCategory;

public sealed record CreateCategoryCommand(
    Guid TenantId,
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    string? AttributeSchemaJson = null) : ICommand<CreateCategoryResponse>;

public sealed record CreateCategoryResponse(Guid CategoryId, Guid TenantId);
