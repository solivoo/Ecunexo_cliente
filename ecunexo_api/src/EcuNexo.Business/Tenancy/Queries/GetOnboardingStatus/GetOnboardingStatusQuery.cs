using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Queries.GetOnboardingStatus;

public sealed record GetOnboardingStatusQuery : IQuery<OnboardingStatusResponse>;

public sealed record OnboardingStatusResponse(bool HasOrganization);
