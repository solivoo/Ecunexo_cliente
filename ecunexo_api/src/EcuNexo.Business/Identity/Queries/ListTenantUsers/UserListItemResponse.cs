namespace EcuNexo.Business.Identity.Queries.ListTenantUsers;

public sealed record UserListItemResponse(
    Guid Id,
    string Email,
    string Name,
    string? Department,
    string? Phone,
    string? JobTitle,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    bool IsDisabled);
