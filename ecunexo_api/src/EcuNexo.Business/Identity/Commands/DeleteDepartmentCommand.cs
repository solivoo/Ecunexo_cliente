using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record DeleteDepartmentCommand(
    Guid TenantId,
    Guid DepartmentId,
    Guid? CurrentUserId = null) : ICommand<DeleteDepartmentResponse>;

public sealed record DeleteDepartmentResponse(Guid DepartmentId, Guid TenantId);
