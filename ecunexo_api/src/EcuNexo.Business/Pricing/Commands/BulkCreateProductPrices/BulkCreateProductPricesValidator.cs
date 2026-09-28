using FluentValidation;

namespace EcuNexo.Business.Pricing.Commands.BulkCreateProductPrices;

public sealed class BulkCreateProductPricesValidator
    : AbstractValidator<BulkCreateProductPricesCommand>
{
    public const int MaxItems = 500;

    public BulkCreateProductPricesValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("La empresa es obligatoria.");

        RuleFor(x => x.PriceListId)
            .NotEmpty()
            .WithMessage("Selecciona la lista de precios.");

        RuleFor(x => x.ValidFrom)
            .NotEmpty()
            .WithMessage("La fecha de vigencia inicial es obligatoria.");

        RuleFor(x => x.Items)
            .NotEmpty()
            .WithMessage("Agrega al menos un producto.");

        RuleFor(x => x.Items)
            .Must(items => items.Count <= MaxItems)
            .WithMessage($"La carga masiva admite hasta {MaxItems} productos por lote.");

        RuleFor(x => x.Items)
            .Must(items => items.Select(i => i.CatalogItemId).Distinct().Count() == items.Count)
            .WithMessage("No repitas el mismo producto en la carga masiva.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.CatalogItemId)
                .NotEmpty()
                .WithMessage("Cada línea debe indicar el producto.");
            item.RuleFor(i => i.Price)
                .GreaterThanOrEqualTo(0)
                .WithMessage("El precio no puede ser negativo.");
        });
    }
}
