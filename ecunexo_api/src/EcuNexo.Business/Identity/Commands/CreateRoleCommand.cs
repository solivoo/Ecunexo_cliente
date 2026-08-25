using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Define un rol nuevo en el tenant (aislado de otros tenants).
/// </summary>
public sealed record CreateRoleCommand(
    Guid TenantId,
    string Name,
    string? Description = null,
    bool IsSystem = false) : ICommand<CreateRoleResponse>;
