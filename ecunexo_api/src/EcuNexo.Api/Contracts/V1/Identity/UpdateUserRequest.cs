using EcuNexo.Business.Identity.Commands;

namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record UpdateUserRequest(
    string Name,
    string? Email = null,
    Guid? DepartmentId = null,
    string? Department = null,
    string? Phone = null,
    string? JobTitle = null)
{
    public UpdateUserCommand ToCommand(Guid tenantId, Guid userId) =>
        new(tenantId, userId, Name, Email, DepartmentId, Department, Phone, JobTitle);
}

public sealed record SetUserDisabledRequest(bool Disabled);

public sealed record SetUserPasswordRequest(string Password);
