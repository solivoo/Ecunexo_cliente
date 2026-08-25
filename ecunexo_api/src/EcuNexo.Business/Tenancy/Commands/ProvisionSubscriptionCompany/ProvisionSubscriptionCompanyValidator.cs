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
            .NotEmpty().WithMessage("El correo del administrador es obligatorio.")
            .EmailAddress().WithMessage("El correo del administrador no es una dirección válida.");
        RuleFor(c => c.OwnerName)
            .NotEmpty().WithMessage("El nombre del administrador es obligatorio.")
            .MaximumLength(User.NameMaxLength).WithMessage($"El nombre del administrador no puede superar {User.NameMaxLength} caracteres.");
        RuleFor(c => c.OwnerPassword)
            .NotEmpty().WithMessage("La contraseña del administrador es obligatoria.")
            .MinimumLength(8).WithMessage("La contraseña debe tener al menos 8 caracteres.");
        RuleFor(c => c.TimeZoneId).MaximumLength(Tenant.TimeZoneIdMaxLength);
        RuleFor(c => c.Locale).MaximumLength(Tenant.LocaleMaxLength);
        RuleFor(c => c.LogoUrl).MaximumLength(Tenant.LogoUrlMaxLength);
        RuleFor(c => c.PrimaryColorHex).MaximumLength(Tenant.PrimaryColorHexMaxLength);
    }
}
