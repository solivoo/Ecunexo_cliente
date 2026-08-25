using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record UpdateDepartmentCommand(
    Guid TenantId,
    Guid DepartmentId,
    string Name,
    string? Description = null) : ICommand<UpdateDepartmentResponse>;

public sealed record UpdateDepartmentResponse(Guid DepartmentId, Guid TenantId);
