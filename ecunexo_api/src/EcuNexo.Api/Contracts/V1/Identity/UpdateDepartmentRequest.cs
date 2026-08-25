using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record UpdateDepartmentRequest(string Name, string? Description = null)
{
    public UpdateDepartmentCommand ToCommand(Guid tenantId, Guid departmentId) =>
        new(tenantId, departmentId, Name, Description);
}
