using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.ApplySubscriptionLicenseUpgrade;

public sealed record ApplySubscriptionLicenseUpgradeCommand(
    Guid SubscriptionAccountId,
    string ActivationCode,
    string LicenseArtifact) : ICommand<ApplySubscriptionLicenseUpgradeResponse>;

public sealed record ApplySubscriptionLicenseUpgradeResponse(
    Guid SubscriptionAccountId,
    string ServicePlanName,
    int MaxUsers,
    int MaxWarehouses,
    int SubscriptionMaxTenants,
    IReadOnlyList<string>? EnabledModules);
