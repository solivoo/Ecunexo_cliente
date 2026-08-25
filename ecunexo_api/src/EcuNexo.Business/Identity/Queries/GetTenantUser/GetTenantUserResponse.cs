namespace EcuNexo.Business.Identity.Queries.GetTenantUser;

public sealed record GetTenantUserResponse(
    Guid Id,
    string Email,
    string Name,
    string? Department,
    Guid? DepartmentId,
    string? Phone,
    string? JobTitle,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    bool IsDisabled,
    IReadOnlyList<Guid> RoleIds,
    IReadOnlyList<string> EffectivePermissionCodes,
    bool IsCompanyOwner);
