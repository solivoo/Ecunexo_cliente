using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Queries.ListPermissionPolicies;

public sealed class ListPermissionPoliciesHandler(
    EcuNexo.Business.Identity.IPermissionRepository permissions,
    EcuNexo.Business.Identity.IPolicyRepository policies)
    : IQueryHandler<ListPermissionPoliciesQuery, IReadOnlyList<PolicyListItemResponse>>
{
    public async Task<Result<IReadOnlyList<PolicyListItemResponse>>> Handle(
        ListPermissionPoliciesQuery query,
        CancellationToken ct)
    {
        var permission = await permissions.GetByIdAsync(query.PermissionId, ct).ConfigureAwait(false);
        if (permission is null)
        {
            return Result.Failure<IReadOnlyList<PolicyListItemResponse>>(
                new Error("permission.not_found", "El permiso no existe.", ErrorType.NotFound));
        }

        var list = await policies.ListByPermissionIdAsync(query.PermissionId, ct).ConfigureAwait(false);
        IReadOnlyList<PolicyListItemResponse> mapped = list.Select(
                p => new PolicyListItemResponse(p.Id, p.Effect, p.Condition, p.CreatedAt))
            .ToList();

        return Result.Success(mapped);
    }
}
