using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.GetOnboardingStatus;

public sealed class GetOnboardingStatusHandler(ISubscriptionAccountRepository accounts)
    : IQueryHandler<GetOnboardingStatusQuery, OnboardingStatusResponse>
{
    public async Task<Result<OnboardingStatusResponse>> Handle(
        GetOnboardingStatusQuery query,
        CancellationToken ct)
    {
        var hasOrganization = await accounts.AnyAsync(ct).ConfigureAwait(false);
        return new OnboardingStatusResponse(hasOrganization);
    }
}
