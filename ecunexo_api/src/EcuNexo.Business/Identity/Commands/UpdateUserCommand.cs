using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record UpdateUserCommand(
    Guid TenantId,
    Guid UserId,
    string Name,
    Guid? DepartmentId = null,
    string? Department = null,
    string? Phone = null,
    string? JobTitle = null) : ICommand<UpdateUserResponse>;

public sealed record UpdateUserResponse(Guid UserId, Guid TenantId);
