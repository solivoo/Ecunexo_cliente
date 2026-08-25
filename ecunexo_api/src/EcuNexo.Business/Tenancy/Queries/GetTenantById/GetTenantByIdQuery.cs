using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Queries.GetTenantById;

public sealed record GetTenantByIdQuery(Guid TenantId) : IQuery<GetTenantByIdResponse>;
