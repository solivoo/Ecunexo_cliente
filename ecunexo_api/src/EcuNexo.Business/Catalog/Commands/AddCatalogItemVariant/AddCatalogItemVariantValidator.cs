using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;

public sealed class AddCatalogItemVariantValidator : AbstractValidator<AddCatalogItemVariantCommand>
{
    public AddCatalogItemVariantValidator()
    {
        RuleFor(c => c.TenantId)
            .NotEmpty()
            .WithMessage("El tenant es obligatorio.");

        RuleFor(c => c.ParentItemId)
            .NotEmpty()
            .WithMessage("El identificador del producto matriz es obligatorio.");

        RuleFor(c => c.VariantTitle)
            .NotEmpty()
            .WithMessage("El título de la variante es obligatorio (ej. 38 - Negro).");

        RuleFor(c => c.Sku)
            .NotEmpty()
            .WithMessage("El SKU de la variante es obligatorio.");

        When(c => c.BasePrice.HasValue, () =>
        {
            RuleFor(c => c.BasePrice!.Value)
                .GreaterThanOrEqualTo(0)
                .WithMessage("El precio base de la variante no puede ser negativo.");
        });

        When(c => c.InitialStock.HasValue && c.InitialStock.Value > 0, () =>
        {
            RuleFor(c => c.InitialStockWarehouseId)
                .NotEmpty()
                .WithMessage("Debe seleccionar una bodega para el stock inicial.");
        });
    }
}
