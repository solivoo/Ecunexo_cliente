namespace EcuNexo.Business.Identity.Commands;

public sealed record GrantRolePermissionResponse(Guid TenantId, Guid RoleId, Guid PermissionId);
