namespace EcuNexo.Business.Tenancy.Queries.ListSubscriptionCompanies;

public sealed record ListSubscriptionCompaniesResponse(
    int MaxTenants,
    int UsedCount,
    int SlotsRemaining,
    bool CanCreateMore,
    IReadOnlyList<SubscriptionCompanyListItemResponse> Companies);
