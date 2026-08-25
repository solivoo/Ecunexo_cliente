using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreateUserRequest(
    string Email,
    string Name,
    string Password,
    Guid? DepartmentId = null,
    string? Department = null,
    string? Phone = null,
    string? JobTitle = null)
{
    public CreateUserCommand ToCommand(Guid tenantId) =>
        new(tenantId, Email, Name, Password, DepartmentId, Department, Phone, JobTitle);
}
