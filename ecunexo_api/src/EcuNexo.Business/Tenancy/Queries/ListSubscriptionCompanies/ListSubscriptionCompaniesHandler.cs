using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.ListSubscriptionCompanies;

public sealed class ListSubscriptionCompaniesHandler(
    ISubscriptionAccountRepository accounts,
    ITenantRepository tenants)
    : IQueryHandler<ListSubscriptionCompaniesQuery, ListSubscriptionCompaniesResponse>
{
    public async Task<Result<ListSubscriptionCompaniesResponse>> Handle(
        ListSubscriptionCompaniesQuery query,
        CancellationToken ct)
    {
        var account = await accounts.GetByIdAsync(query.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<ListSubscriptionCompaniesResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var group = await tenants.ListBySubscriptionGroupIdAsync(account.SubscriptionGroupId, ct).ConfigureAwait(false);
        var used = group.Count;
        var max = account.SubscriptionMaxTenants;
        var remaining = Math.Max(0, max - used);

        var companies = group
            .Select(t => new SubscriptionCompanyListItemResponse(
                t.Id,
                t.Name,
                t.Status,
                t.CreatedAt,
                false))
            .ToList();

        return new ListSubscriptionCompaniesResponse(
            max,
            used,
            remaining,
            remaining > 0,
            companies);
    }
}
