using EcuNexo.Business.Tenancy.Commands.ApplySubscriptionLicenseUpgrade;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record ApplySubscriptionLicenseUpgradeRequest(string ActivationCode, string LicenseArtifact)
{
    public ApplySubscriptionLicenseUpgradeCommand ToCommand(Guid subscriptionAccountId) =>
        new(subscriptionAccountId, ActivationCode, LicenseArtifact);
}
