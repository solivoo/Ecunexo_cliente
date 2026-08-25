using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record UnassignRolePermissionCommand(Guid TenantId, Guid RoleId, Guid PermissionId)
    : ICommand<UnassignRolePermissionResponse>;

public sealed record UnassignRolePermissionResponse(Guid TenantId, Guid RoleId, Guid PermissionId);
