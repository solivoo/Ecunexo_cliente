using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.GetTenantUser;

public sealed class GetTenantUserHandler(
    IUserRepository users,
    IUserRoleRepository userRoles,
    IUserPermissionQuery permissions,
    ICompanyOwnerGuard companyOwner)
    : IQueryHandler<GetTenantUserQuery, GetTenantUserResponse>
{
    public async Task<Result<GetTenantUserResponse>> Handle(GetTenantUserQuery query, CancellationToken ct)
    {
        var u = await users.GetActiveByIdAsync(query.TenantId, query.UserId, ct).ConfigureAwait(false);
        if (u is null)
        {
            return Result.Failure<GetTenantUserResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        var roleIds = await userRoles.ListRoleIdsForUserAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);
        var codes = await permissions.ListEffectivePermissionCodesAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);
        var isOwner = await companyOwner.IsCompanyOwnerAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);

        return new GetTenantUserResponse(
            u.Id,
            u.Email.Value,
            u.Name,
            u.Department,
            u.DepartmentId,
            u.Phone,
            u.JobTitle,
            u.LastLoginAt,
            u.CreatedAt,
            u.UpdatedAt,
            u.IsDisabled,
            roleIds,
            codes,
            isOwner);
    }
}
