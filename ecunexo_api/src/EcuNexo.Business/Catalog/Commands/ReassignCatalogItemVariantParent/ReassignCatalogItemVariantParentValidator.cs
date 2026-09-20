using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.ReassignCatalogItemVariantParent;

public sealed class ReassignCatalogItemVariantParentValidator
    : AbstractValidator<ReassignCatalogItemVariantParentCommand>
{
    public ReassignCatalogItemVariantParentValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("El identificador de la empresa (tenantId) es obligatorio.");

        RuleFor(x => x.VariantItemId)
            .NotEmpty()
            .WithMessage("El identificador de la variante (variantItemId) es obligatorio.");

        RuleFor(x => x.Reason)
            .NotEmpty()
            .WithMessage("El motivo de reasignación es obligatorio para fines de auditoría.")
            .MinimumLength(3)
            .WithMessage("El motivo debe contener al menos 3 caracteres.")
            .MaximumLength(500)
            .WithMessage("El motivo no puede superar 500 caracteres.");
    }
}
