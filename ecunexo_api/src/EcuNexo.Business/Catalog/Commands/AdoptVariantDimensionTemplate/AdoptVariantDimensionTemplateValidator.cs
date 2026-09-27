using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.AdoptVariantDimensionTemplate;

public sealed class AdoptVariantDimensionTemplateValidator
    : AbstractValidator<AdoptVariantDimensionTemplateCommand>
{
    public AdoptVariantDimensionTemplateValidator()
    {
        RuleFor(x => x.TemplateId)
            .NotEmpty()
            .WithMessage("El id de la plantilla es obligatorio.");

        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("El id de la empresa es obligatorio.");

        RuleFor(x => x.SourceAttributeName)
            .NotEmpty()
            .WithMessage("El nombre del atributo de origen es obligatorio.")
            .MaximumLength(VariantDimensionTemplate.NameMaxLength)
            .WithMessage($"El nombre del atributo de origen no puede superar {VariantDimensionTemplate.NameMaxLength} caracteres.");
    }
}
