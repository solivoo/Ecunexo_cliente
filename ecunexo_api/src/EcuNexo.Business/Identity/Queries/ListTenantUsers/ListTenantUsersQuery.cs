using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.ListTenantUsers;

public sealed record ListTenantUsersQuery(Guid TenantId)
    : IQuery<IReadOnlyList<UserListItemResponse>>;
