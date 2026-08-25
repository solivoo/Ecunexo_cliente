using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.UpdateSubscriptionCompany;

public sealed class UpdateSubscriptionCompanyValidator : AbstractValidator<UpdateSubscriptionCompanyCommand>
{
    public UpdateSubscriptionCompanyValidator()
    {
        RuleFor(c => c.SubscriptionAccountId).NotEmpty();
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.Name)
            .NotEmpty().WithMessage("El nombre de la empresa es obligatorio.")
            .MaximumLength(Tenant.MaxNameLength)
            .WithMessage($"El nombre de la empresa no puede superar {Tenant.MaxNameLength} caracteres.");
        RuleFor(c => c.TimeZoneId).MaximumLength(Tenant.TimeZoneIdMaxLength);
        RuleFor(c => c.Locale).MaximumLength(Tenant.LocaleMaxLength);
        RuleFor(c => c.LogoUrl).MaximumLength(Tenant.LogoUrlMaxLength);
        RuleFor(c => c.PrimaryColorHex).MaximumLength(Tenant.PrimaryColorHexMaxLength);
        RuleFor(c => c.TaxId)
            .Matches(@"^\d{13}$")
            .When(c => !string.IsNullOrWhiteSpace(c.TaxId))
            .WithMessage("El RUC debe tener exactamente 13 dígitos.");
        RuleFor(c => c.LegalName).MaximumLength(Tenant.LegalNameMaxLength);
        RuleFor(c => c.City).MaximumLength(Tenant.CityMaxLength);
        RuleFor(c => c.EstablishmentCode).MaximumLength(Tenant.EstablishmentCodeMaxLength);
        RuleFor(c => c.Address).MaximumLength(Tenant.AddressMaxLength);
        RuleFor(c => c.ContactEmail).MaximumLength(Tenant.ContactEmailMaxLength);
        RuleFor(c => c.ContactPhone).MaximumLength(Tenant.ContactPhoneMaxLength);
        RuleFor(c => c.RideThankYouText).MaximumLength(Tenant.RideThankYouTextMaxLength);
        RuleFor(c => c.ContactEmail)
            .EmailAddress()
            .When(c => !string.IsNullOrWhiteSpace(c.ContactEmail))
            .WithMessage("El correo de contacto no es válido.");
    }
}
