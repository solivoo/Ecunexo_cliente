using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record GrantRolePermissionRequest(Guid PermissionId)
{
    public GrantRolePermissionCommand ToCommand(Guid tenantId, Guid roleId) =>
        new(tenantId, roleId, PermissionId);
}
