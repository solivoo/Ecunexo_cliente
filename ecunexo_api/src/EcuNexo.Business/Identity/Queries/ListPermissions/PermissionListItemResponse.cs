using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity.Queries.ListPermissions;

public sealed record PermissionListItemResponse(
    Guid Id,
    string Code,
    string? DisplayName,
    string? Module,
    int SortOrder,
    string? Description,
    PermissionStatus Status,
    DateTimeOffset CreatedAt);
