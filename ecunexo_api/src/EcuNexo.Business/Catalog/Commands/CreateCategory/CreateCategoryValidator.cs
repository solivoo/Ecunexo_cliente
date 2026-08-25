using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCategory;

public sealed class CreateCategoryValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(Category.NameMaxLength);
        RuleFor(x => x.Description)
            .MaximumLength(Category.DescriptionMaxLength)
            .When(x => x.Description is not null);
    }
}
