using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Queries.ListSubscriptionCompanies;

public sealed record SubscriptionCompanyListItemResponse(
    Guid Id,
    string Name,
    TenantStatus Status,
    DateTimeOffset CreatedAt,
    bool IsCurrent);
