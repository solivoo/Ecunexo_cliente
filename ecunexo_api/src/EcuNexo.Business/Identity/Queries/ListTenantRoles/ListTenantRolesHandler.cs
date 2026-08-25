using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.ListTenantRoles;

public sealed class ListTenantRolesHandler(EcuNexo.Business.Identity.IRoleRepository roles)
    : IQueryHandler<ListTenantRolesQuery, IReadOnlyList<RoleListItemResponse>>
{
    public async Task<Result<IReadOnlyList<RoleListItemResponse>>> Handle(
        ListTenantRolesQuery query,
        CancellationToken ct)
    {
        var list = await roles.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        IReadOnlyList<RoleListItemResponse> mapped = list.Select(r => new RoleListItemResponse(
                r.Id,
                r.Name,
                r.Description,
                r.IsSystem,
                r.CreatedAt))
            .ToList();

        return Result.Success(mapped);
    }
}
