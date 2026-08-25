using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.ListTenantRoles;

public sealed record ListTenantRolesQuery(Guid TenantId)
    : IQuery<IReadOnlyList<RoleListItemResponse>>;
