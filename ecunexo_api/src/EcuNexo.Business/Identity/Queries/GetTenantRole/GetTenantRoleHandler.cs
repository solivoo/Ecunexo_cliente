using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.GetTenantRole;

public sealed class GetTenantRoleHandler(
    EcuNexo.Business.Identity.IRoleRepository roles,
    EcuNexo.Business.Identity.IRolePermissionRepository rolePermissions)
    : IQueryHandler<GetTenantRoleQuery, GetTenantRoleResponse>
{
    public async Task<Result<GetTenantRoleResponse>> Handle(GetTenantRoleQuery query, CancellationToken ct)
    {
        var role = await roles.GetActiveByIdAsync(query.TenantId, query.RoleId, ct).ConfigureAwait(false);
        if (role is null)
        {
            return Result.Failure<GetTenantRoleResponse>(
                new Error("role.not_found", "El rol no existe en este tenant.", ErrorType.NotFound));
        }

        var permIds = await rolePermissions.ListPermissionIdsByRoleAsync(query.TenantId, query.RoleId, ct)
            .ConfigureAwait(false);

        return new GetTenantRoleResponse(
            role.Id,
            role.Name,
            role.Description,
            role.IsSystem,
            role.CreatedAt,
            role.UpdatedAt,
            permIds);
    }
}
