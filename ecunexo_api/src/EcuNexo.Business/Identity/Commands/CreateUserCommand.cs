using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Alta de un usuario bajo un tenant existente.
/// </summary>
public sealed record CreateUserCommand(
    Guid TenantId,
    string Email,
    string Name,
    string Password,
    Guid? DepartmentId = null,
    string? Department = null,
    string? Phone = null,
    string? JobTitle = null) : ICommand<CreateUserResponse>;
