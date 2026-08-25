using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands;

public sealed class CreateTenantValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(Tenant.MaxNameLength);

        RuleFor(x => x.ServicePlanName)
            .NotEmpty()
            .MaximumLength(ServicePlan.MaxNameLength);

        RuleFor(x => x.MaxUsers)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.MaxWarehouses)
            .GreaterThanOrEqualTo(0);

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
    }
}
