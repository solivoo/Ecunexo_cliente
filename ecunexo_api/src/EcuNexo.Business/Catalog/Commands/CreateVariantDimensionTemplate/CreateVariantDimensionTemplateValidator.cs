using EcuNexo.Core.Catalog;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateVariantDimensionTemplate;

public sealed class CreateVariantDimensionTemplateValidator : AbstractValidator<CreateVariantDimensionTemplateCommand>
{
    public CreateVariantDimensionTemplateValidator()
    {
        RuleFor(c => c.TenantId)
            .NotEmpty()
            .WithMessage("El tenant es obligatorio.");

        RuleFor(c => c.Name)
            .NotEmpty()
            .WithMessage("El nombre de la escala es obligatorio.")
            .MaximumLength(120)
            .WithMessage("El nombre no puede superar 120 caracteres.");

        RuleFor(c => c.PredefinedValuesJson)
            .NotEmpty()
            .When(c => c.IsVariantAxis)
            .WithMessage("Los atributos que generan variantes con SKU deben incluir al menos un valor predefinido.");

        RuleFor(c => c.DataType)
            .Must(VariantDimensionTemplate.IsValidDataType)
            .WithMessage("El tipo de dato debe ser texto, número, booleano o color.");
    }
}
