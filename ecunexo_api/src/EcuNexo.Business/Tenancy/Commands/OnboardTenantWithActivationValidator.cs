using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands;

public sealed class OnboardTenantWithActivationValidator : AbstractValidator<OnboardTenantWithActivationCommand>
{
    public OnboardTenantWithActivationValidator()
    {
        RuleFor(x => x.ActivationCode)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.TenantName)
            .NotEmpty()
            .MaximumLength(Tenant.MaxNameLength);

        RuleFor(x => x.OwnerEmail)
            .NotEmpty()
            .MaximumLength(Email.MaxLength)
            .EmailAddress();

        RuleFor(x => x.OwnerName)
            .NotEmpty()
            .MaximumLength(User.NameMaxLength);

        RuleFor(x => x.OwnerPassword)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(128);

        RuleFor(x => x.TimeZoneId!)
            .MaximumLength(Tenant.TimeZoneIdMaxLength)
            .When(x => x.TimeZoneId is not null);

        RuleFor(x => x.Locale!)
            .MaximumLength(Tenant.LocaleMaxLength)
            .When(x => x.Locale is not null);

        RuleFor(x => x.LogoUrl!)
            .MaximumLength(Tenant.LogoUrlMaxLength)
            .When(x => x.LogoUrl is not null);

        RuleFor(x => x.PrimaryColorHex!)
            .MaximumLength(Tenant.PrimaryColorHexMaxLength)
            .Matches("^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$")
            .When(x => !string.IsNullOrWhiteSpace(x.PrimaryColorHex));

        RuleFor(x => x.OwnerDepartment)
            .MaximumLength(User.DepartmentMaxLength)
            .When(x => x.OwnerDepartment is not null);

        RuleFor(x => x.OwnerPhone!)
            .MaximumLength(User.PhoneMaxLength)
            .When(x => x.OwnerPhone is not null);

        RuleFor(x => x.OwnerJobTitle!)
            .MaximumLength(User.JobTitleMaxLength)
            .When(x => x.OwnerJobTitle is not null);
    }
}
