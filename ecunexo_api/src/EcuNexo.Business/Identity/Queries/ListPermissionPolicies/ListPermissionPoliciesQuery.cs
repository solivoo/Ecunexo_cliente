using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.ListPermissionPolicies;

public sealed record ListPermissionPoliciesQuery(Guid PermissionId)
    : IQuery<IReadOnlyList<PolicyListItemResponse>>;
