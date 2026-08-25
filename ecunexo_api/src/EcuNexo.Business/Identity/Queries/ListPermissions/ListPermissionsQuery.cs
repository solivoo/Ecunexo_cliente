using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.ListPermissions;

public sealed record ListPermissionsQuery : IQuery<IReadOnlyList<PermissionListItemResponse>>;
