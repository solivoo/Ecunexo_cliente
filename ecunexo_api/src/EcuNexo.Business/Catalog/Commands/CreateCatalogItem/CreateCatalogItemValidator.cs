using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCatalogItem;

public sealed class CreateCatalogItemValidator : AbstractValidator<CreateCatalogItemCommand>
{
    public CreateCatalogItemValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Kind).IsInEnum();
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(CatalogItem.NameMaxLength);
        RuleFor(x => x.Description)
            .MaximumLength(CatalogItem.DescriptionMaxLength)
            .When(x => x.Description is not null);
        RuleFor(x => x.Sku)
            .MaximumLength(Sku.MaxLength)
            .When(x => x.Sku is not null);
        RuleFor(x => x.BasePrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.BasePrice is not null);
    }
}
