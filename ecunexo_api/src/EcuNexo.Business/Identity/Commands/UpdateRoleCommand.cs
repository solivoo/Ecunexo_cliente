using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record UpdateRoleCommand(
    Guid TenantId,
    Guid RoleId,
    string Name,
    string? Description = null) : ICommand<UpdateRoleResponse>;

public sealed record UpdateRoleResponse(Guid RoleId, Guid TenantId);
