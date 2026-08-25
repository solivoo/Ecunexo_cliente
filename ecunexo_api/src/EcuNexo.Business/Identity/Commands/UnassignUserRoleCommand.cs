using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record UnassignUserRoleCommand(Guid TenantId, Guid UserId, Guid RoleId)
    : ICommand<UnassignUserRoleResponse>;

public sealed record UnassignUserRoleResponse(Guid TenantId, Guid UserId, Guid RoleId);
