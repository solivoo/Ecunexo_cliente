using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

/// <summary>
/// Otorga un rol a un usuario del mismo tenant.
/// </summary>
public sealed record AssignUserRoleCommand(Guid TenantId, Guid UserId, Guid RoleId) : ICommand<AssignUserRoleResponse>;
