using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.GetTenantRole;

public sealed record GetTenantRoleQuery(Guid TenantId, Guid RoleId) : IQuery<GetTenantRoleResponse>;
