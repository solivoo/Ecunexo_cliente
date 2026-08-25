using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;

public sealed class UpdateTenantSriLegalValidator : AbstractValidator<UpdateTenantSriLegalCommand>
{
    public UpdateTenantSriLegalValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.TaxId)
            .Matches(@"^\d{13}$")
            .When(c => !string.IsNullOrWhiteSpace(c.TaxId))
            .WithMessage("El RUC debe tener exactamente 13 dígitos.");
        RuleFor(c => c.LegalName).MaximumLength(300);
        RuleFor(c => c.City).MaximumLength(120);
        RuleFor(c => c.EstablishmentCode).MaximumLength(20);
        RuleFor(c => c.Address).MaximumLength(500);
    }
}
