namespace EcuNexo.Business.Identity.Commands;

public sealed record AssignUserRoleResponse(Guid TenantId, Guid UserId, Guid RoleId);
