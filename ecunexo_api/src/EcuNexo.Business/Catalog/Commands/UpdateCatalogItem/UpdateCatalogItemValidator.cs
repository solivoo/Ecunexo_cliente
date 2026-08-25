using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;

public sealed class UpdateCatalogItemValidator : AbstractValidator<UpdateCatalogItemCommand>
{
    public UpdateCatalogItemValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.ItemId).NotEmpty();
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
        RuleFor(x => x.Status)
            .IsInEnum()
            .When(x => x.Status is not null);
        RuleFor(x => x.Kind)
            .IsInEnum()
            .When(x => x.Kind is not null);
    }
}
