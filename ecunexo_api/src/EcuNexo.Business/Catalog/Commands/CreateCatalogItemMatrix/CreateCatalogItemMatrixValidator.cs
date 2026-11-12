using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;

public sealed class CreateCatalogItemMatrixValidator : AbstractValidator<CreateCatalogItemMatrixCommand>
{
    public CreateCatalogItemMatrixValidator()
    {
        RuleFor(c => c.TenantId)
            .NotEmpty()
            .WithMessage("El tenant es obligatorio.");

        // Name es metadata interna (UUID es la identidad); se resuelve en el handler si viene vacío.
        RuleFor(c => c.Name)
            .MaximumLength(200)
            .When(c => !string.IsNullOrWhiteSpace(c.Name))
            .WithMessage("El nombre no puede superar 200 caracteres.");

        RuleFor(c => c.VariantDimensionsJson)
            .NotEmpty()
            .WithMessage("Debe configurar las dimensiones del producto matriz (ej. Talla).");

        RuleFor(c => c.Variants)
            .NotEmpty()
            .WithMessage("Debe definir al menos una variante para el producto matriz.");

        RuleForEach(c => c.Variants).ChildRules(v =>
        {
            v.RuleFor(x => x.VariantTitle)
                .NotEmpty()
                .WithMessage("El título de la variante es obligatorio.");

            v.RuleFor(x => x.Sku)
                .NotEmpty()
                .WithMessage("El SKU de cada variante es obligatorio.");
        });
    }
}
