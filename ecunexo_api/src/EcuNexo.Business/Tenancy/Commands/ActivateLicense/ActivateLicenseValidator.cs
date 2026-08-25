using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ActivateLicense;

public sealed class ActivateLicenseValidator : AbstractValidator<ActivateLicenseCommand>
{
    public ActivateLicenseValidator()
    {
        RuleFor(x => x.ActivationCode).NotEmpty().MinimumLength(8);
        RuleFor(x => x.LicenseArtifact).NotEmpty();
    }
}
