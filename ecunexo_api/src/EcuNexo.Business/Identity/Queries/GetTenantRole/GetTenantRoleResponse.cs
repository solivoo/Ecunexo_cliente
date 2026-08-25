namespace EcuNexo.Business.Identity.Queries.GetTenantRole;

public sealed record GetTenantRoleResponse(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystem,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<Guid> PermissionIds);
