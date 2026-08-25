using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity.Queries.GetPermissionById;

public sealed record PermissionDetailResponse(
    Guid Id,
    string Code,
    string? DisplayName,
    string? Module,
    int SortOrder,
    string? Description,
    PermissionStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
