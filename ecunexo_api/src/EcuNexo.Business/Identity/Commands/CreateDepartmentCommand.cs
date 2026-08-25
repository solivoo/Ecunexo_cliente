using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record CreateDepartmentCommand(
    Guid TenantId,
    string Name,
    string? Description = null) : ICommand<CreateDepartmentResponse>;

public sealed record CreateDepartmentResponse(Guid DepartmentId, Guid TenantId);
