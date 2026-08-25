using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.GetPermissionById;

public sealed class GetPermissionByIdHandler(EcuNexo.Business.Identity.IPermissionRepository permissions)
    : IQueryHandler<GetPermissionByIdQuery, PermissionDetailResponse>
{
    public async Task<Result<PermissionDetailResponse>> Handle(GetPermissionByIdQuery query, CancellationToken ct)
    {
        var p = await permissions.GetByIdAsync(query.PermissionId, ct).ConfigureAwait(false);
        if (p is null)
        {
            return Result.Failure<PermissionDetailResponse>(
                new Error("permission.not_found", "El permiso no existe.", ErrorType.NotFound));
        }

        return new PermissionDetailResponse(
            p.Id,
            p.Code,
            p.DisplayName,
            p.Module,
            p.SortOrder,
            p.Description,
            p.Status,
            p.CreatedAt,
            p.UpdatedAt);
    }
}
