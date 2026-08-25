using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record AssignUserRoleRequest(Guid RoleId)
{
    public AssignUserRoleCommand ToCommand(Guid tenantId, Guid userId) =>
        new(tenantId, userId, RoleId);
}
