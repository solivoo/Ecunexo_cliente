using FluentValidation;

namespace EcuNexo.Business.Pricing.Commands.BulkUpsertMatrixPrices;

public sealed class BulkUpsertMatrixPricesValidator
    : AbstractValidator<BulkUpsertMatrixPricesCommand>
{
    public const int MaxEntries = 2000;

    public BulkUpsertMatrixPricesValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("La empresa es obligatoria.");

        RuleFor(x => x.ValidFrom)
            .NotEmpty()
            .WithMessage("La fecha de vigencia inicial es obligatoria.");

        RuleFor(x => x.Entries)
            .NotEmpty()
            .WithMessage("Agrega al menos un precio para actualizar.");

        RuleFor(x => x.Entries)
            .Must(entries => entries.Count <= MaxEntries)
            .WithMessage($"El lote admite hasta {MaxEntries} celdas por operación.");

        RuleFor(x => x.Entries)
            .Must(entries => entries.Select(e => (e.PriceListId, e.CatalogItemId)).Distinct().Count() == entries.Count)
            .WithMessage("No repitas la misma combinación de producto y lista en el lote.");

        RuleForEach(x => x.Entries).ChildRules(entry =>
        {
            entry.RuleFor(e => e.PriceListId)
                .NotEmpty()
                .WithMessage("Cada línea debe indicar la lista de precios.");
            entry.RuleFor(e => e.CatalogItemId)
                .NotEmpty()
                .WithMessage("Cada línea debe indicar el producto.");
            entry.RuleFor(e => e.Price)
                .GreaterThanOrEqualTo(0)
                .WithMessage("El precio no puede ser negativo.");
        });
    }
}
