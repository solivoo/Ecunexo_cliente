using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;

public sealed class ProvisionSubscriptionCompanyValidator : AbstractValidator<ProvisionSubscriptionCompanyCommand>
{
    public ProvisionSubscriptionCompanyValidator()
    {
        RuleFor(c => c.SubscriptionAccountId).NotEmpty();
        RuleFor(c => c.TenantName)
            .NotEmpty().WithMessage("El nombre de la empresa es obligatorio.")
            .MaximumLength(Tenant.MaxNameLength).WithMessage($"El nombre de la empresa no puede superar {Tenant.MaxNameLength} caracteres.");
        RuleFor(c => c.OwnerEmail)
            .EmailAddress().WithMessage("El correo del administrador no es una dirección válida.")
            .When(c => !string.IsNullOrWhiteSpace(c.OwnerEmail));
        RuleFor(c => c.OwnerName)
            .MaximumLength(User.NameMaxLength).WithMessage($"El nombre del administrador no puede superar {User.NameMaxLength} caracteres.")
            .When(c => !string.IsNullOrWhiteSpace(c.OwnerName));
        RuleFor(c => c.OwnerPassword)
            .MinimumLength(8).WithMessage("La contraseña debe tener al menos 8 caracteres.")
            .When(c => !string.IsNullOrWhiteSpace(c.OwnerPassword));
        RuleFor(c => c.TimeZoneId).MaximumLength(Tenant.TimeZoneIdMaxLength);
        RuleFor(c => c.Locale).MaximumLength(Tenant.LocaleMaxLength);
        RuleFor(c => c.LogoUrl).MaximumLength(Tenant.LogoUrlMaxLength);
        RuleFor(c => c.PrimaryColorHex).MaximumLength(Tenant.PrimaryColorHexMaxLength);
    }
}
