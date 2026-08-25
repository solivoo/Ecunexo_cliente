using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Asocia un permiso global a un rol del tenant.
/// </summary>
public sealed record GrantRolePermissionCommand(Guid TenantId, Guid RoleId, Guid PermissionId)
    : ICommand<GrantRolePermissionResponse>;
