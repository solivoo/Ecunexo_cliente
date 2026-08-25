using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Queries.GetTenantById;

namespace EcuNexo.Business.Tenancy.Queries.GetSubscriptionCompany;

public sealed record GetSubscriptionCompanyQuery(
    Guid SubscriptionAccountId,
    Guid TenantId) : IQuery<GetTenantByIdResponse>;
