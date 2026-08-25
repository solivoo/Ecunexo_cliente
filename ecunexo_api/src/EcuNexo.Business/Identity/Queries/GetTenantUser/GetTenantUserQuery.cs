using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Queries.GetTenantUser;

public sealed record GetTenantUserQuery(Guid TenantId, Guid UserId) : IQuery<GetTenantUserResponse>;
