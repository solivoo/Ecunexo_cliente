using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record DeleteRoleCommand(
    Guid TenantId,
    Guid RoleId,
    Guid? CurrentUserId = null) : ICommand<DeleteRoleResponse>;

public sealed record DeleteRoleResponse(Guid RoleId, Guid TenantId);
