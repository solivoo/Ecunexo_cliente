using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.UpdateProductTemplate;

public sealed record UpdateProductTemplateCommand(
    Guid TemplateId,
    Guid TenantId,
    string Name,
    string? Description,
    string HierarchyTreeJson,
    bool IsActive,
    Guid? UpdatedBy = null) : ICommand<UpdateProductTemplateResponse>;

public sealed record UpdateProductTemplateResponse(Guid Id, Guid TenantId);
