using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record ReplaceRolePermissionsCommand(
    Guid TenantId,
    Guid RoleId,
    IReadOnlyList<Guid> PermissionIds) : ICommand<ReplaceRolePermissionsResponse>;

public sealed record ReplaceRolePermissionsResponse(
    Guid TenantId,
    Guid RoleId,
    int Granted,
    int Revoked,
    IReadOnlyList<Guid> PermissionIds);
