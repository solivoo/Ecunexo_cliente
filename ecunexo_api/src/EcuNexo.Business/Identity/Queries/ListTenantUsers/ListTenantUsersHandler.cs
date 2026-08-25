using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.ListTenantUsers;

public sealed class ListTenantUsersHandler(EcuNexo.Business.Identity.IUserRepository users)
    : IQueryHandler<ListTenantUsersQuery, IReadOnlyList<UserListItemResponse>>
{
    public async Task<Result<IReadOnlyList<UserListItemResponse>>> Handle(
        ListTenantUsersQuery query,
        CancellationToken ct)
    {
        var list = await users.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        IReadOnlyList<UserListItemResponse> mapped = list.Select(
                u => new UserListItemResponse(
                    u.Id,
                    u.Email.Value,
                    u.Name,
                    u.Department,
                    u.Phone,
                    u.JobTitle,
                    u.LastLoginAt,
                    u.CreatedAt,
                    u.IsDisabled))
            .ToList();

        return Result.Success(mapped);
    }
}
