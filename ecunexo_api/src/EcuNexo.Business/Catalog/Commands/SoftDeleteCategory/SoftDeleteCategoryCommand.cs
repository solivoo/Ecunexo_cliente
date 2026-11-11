using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.SoftDeleteCategory;

public sealed record SoftDeleteCategoryCommand(Guid TenantId, Guid CategoryId)
    : ICommand<SoftDeleteCategoryResponse>;

public sealed record SoftDeleteCategoryResponse(Guid CategoryId, Guid TenantId);
