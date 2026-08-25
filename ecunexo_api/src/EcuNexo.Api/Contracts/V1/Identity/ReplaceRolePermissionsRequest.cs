using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record ReplaceRolePermissionsRequest(IReadOnlyList<Guid> PermissionIds)
{
    public ReplaceRolePermissionsCommand ToCommand(Guid tenantId, Guid roleId) =>
        new(tenantId, roleId, PermissionIds ?? Array.Empty<Guid>());
}
