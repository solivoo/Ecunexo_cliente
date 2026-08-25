using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.ListPermissions;

public sealed class ListPermissionsHandler(EcuNexo.Business.Identity.IPermissionRepository permissions)
    : IQueryHandler<ListPermissionsQuery, IReadOnlyList<PermissionListItemResponse>>
{
    public async Task<Result<IReadOnlyList<PermissionListItemResponse>>> Handle(
        ListPermissionsQuery query,
        CancellationToken ct)
    {
        _ = query;
        var list = await permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false);
        IReadOnlyList<PermissionListItemResponse> mapped = list.Select(
                p => new PermissionListItemResponse(
                    p.Id,
                    p.Code,
                    p.DisplayName,
                    p.Module,
                    p.SortOrder,
                    p.Description,
                    p.Status,
                    p.CreatedAt))
            .ToList();

        return Result.Success(mapped);
    }
}
