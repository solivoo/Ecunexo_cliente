using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ApplySubscriptionLicenseUpgrade;

public sealed class ApplySubscriptionLicenseUpgradeValidator
    : AbstractValidator<ApplySubscriptionLicenseUpgradeCommand>
{
    public ApplySubscriptionLicenseUpgradeValidator()
    {
        RuleFor(c => c.SubscriptionAccountId).NotEmpty();
        RuleFor(c => c.ActivationCode).NotEmpty().MinimumLength(8);
        RuleFor(c => c.LicenseArtifact).NotEmpty();
    }
}
