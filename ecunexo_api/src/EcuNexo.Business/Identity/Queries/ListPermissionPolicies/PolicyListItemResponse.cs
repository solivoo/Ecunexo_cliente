using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity.Queries.ListPermissionPolicies;

public sealed record PolicyListItemResponse(
    Guid Id,
    PolicyEffect Effect,
    string? Condition,
    DateTimeOffset CreatedAt);
