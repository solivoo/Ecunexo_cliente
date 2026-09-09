using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record UpdateRoleRequest(string Name, string? Description = null)
{
    public UpdateRoleCommand ToCommand(Guid tenantId, Guid roleId) =>
        new(tenantId, roleId, Name, Description);
}
