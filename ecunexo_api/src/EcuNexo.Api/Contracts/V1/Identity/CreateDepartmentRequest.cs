using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreateDepartmentRequest(string Name, string? Description = null)
{
    public CreateDepartmentCommand ToCommand(Guid tenantId) => new(tenantId, Name, Description);
}
