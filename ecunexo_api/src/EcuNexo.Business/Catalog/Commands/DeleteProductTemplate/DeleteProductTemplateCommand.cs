using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Catalog.Commands.DeleteProductTemplate;

public sealed record DeleteProductTemplateCommand(
    Guid TemplateId,
    Guid TenantId) : ICommand<DeleteProductTemplateResponse>;

public sealed record DeleteProductTemplateResponse(Guid Id, Guid TenantId);
