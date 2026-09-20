using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.CreateProductTemplate;

public sealed record CreateProductTemplateCommand(
    Guid TenantId,
    string Name,
    string? Description,
    string HierarchyTreeJson,
    bool IsActive = true,
    Guid? CreatedBy = null) : ICommand<CreateProductTemplateResponse>;

public sealed record CreateProductTemplateResponse(Guid Id, Guid TenantId);
