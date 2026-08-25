using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreateRoleRequest(string Name, string? Description = null, bool IsSystem = false)
{
    public CreateRoleCommand ToCommand(Guid tenantId) =>
        new(tenantId, Name, Description, IsSystem);
}
