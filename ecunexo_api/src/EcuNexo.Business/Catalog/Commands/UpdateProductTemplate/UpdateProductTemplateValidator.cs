using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateProductTemplate;

public sealed class UpdateProductTemplateValidator : AbstractValidator<UpdateProductTemplateCommand>
{
    public UpdateProductTemplateValidator()
    {
        RuleFor(c => c.TemplateId)
            .NotEmpty()
            .WithMessage("El id de la plantilla es obligatorio.");

        RuleFor(c => c.TenantId)
            .NotEmpty()
            .WithMessage("El id del tenant es obligatorio.");

        RuleFor(c => c.Name)
            .NotEmpty()
            .WithMessage("El nombre de la plantilla es obligatorio.")
            .MaximumLength(ProductTemplate.NameMaxLength)
            .WithMessage($"El nombre no puede superar {ProductTemplate.NameMaxLength} caracteres.");

        RuleFor(c => c.Description)
            .MaximumLength(ProductTemplate.DescriptionMaxLength)
            .WithMessage($"La descripción no puede superar {ProductTemplate.DescriptionMaxLength} caracteres.")
            .When(c => !string.IsNullOrEmpty(c.Description));

        RuleFor(c => c.HierarchyTreeJson)
            .NotEmpty()
            .WithMessage("La estructura de la plantilla es obligatoria.");
    }
}
