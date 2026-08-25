using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Queries.ListSubscriptionCompanies;

public sealed record ListSubscriptionCompaniesQuery(Guid SubscriptionAccountId) : IQuery<ListSubscriptionCompaniesResponse>;
