using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

public sealed class UpdateVariantDimensionTemplateValidator : AbstractValidator<UpdateVariantDimensionTemplateCommand>
{
    public UpdateVariantDimensionTemplateValidator()
    {
        RuleFor(x => x.TemplateId)
            .NotEmpty()
            .WithMessage("El id de la plantilla es obligatorio.");

        RuleFor(x => x.TenantId)
            .NotEmpty()
            .WithMessage("El id de la empresa es obligatorio.");

        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("El nombre de la plantilla es obligatorio.")
            .MaximumLength(VariantDimensionTemplate.NameMaxLength)
            .WithMessage($"El nombre no puede superar {VariantDimensionTemplate.NameMaxLength} caracteres.");

        RuleFor(x => x.DimensionType)
            .NotEmpty()
            .WithMessage("El tipo de dimensión es obligatorio.")
            .MaximumLength(VariantDimensionTemplate.DimensionTypeMaxLength)
            .WithMessage($"El tipo de dimensión no puede superar {VariantDimensionTemplate.DimensionTypeMaxLength} caracteres.");

        RuleFor(x => x.PredefinedValuesJson)
            .NotEmpty()
            .WithMessage("La lista de valores predefinidos es obligatoria.");

        RuleFor(x => x.DataType)
            .Must(VariantDimensionTemplate.IsValidDataType)
            .WithMessage("El tipo de dato debe ser texto, número, booleano o color.");
    }
}
