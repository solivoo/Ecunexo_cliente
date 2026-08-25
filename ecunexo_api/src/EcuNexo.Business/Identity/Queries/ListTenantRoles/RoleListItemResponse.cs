namespace EcuNexo.Business.Identity.Queries.ListTenantRoles;

public sealed record RoleListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystem,
    DateTimeOffset CreatedAt);
