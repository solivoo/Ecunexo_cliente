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
            .When(x => x.IsVariantAxis)
            .WithMessage("Los atributos que generan variantes con SKU deben incluir al menos un valor predefinido.");

        RuleFor(x => x.DataType)
            .Must(VariantDimensionTemplate.IsValidDataType)
            .WithMessage("El tipo de dato debe ser texto, número, booleano, color, selección múltiple, lista de colores o fotos.");

        RuleForEach(x => x.ValueRenames).ChildRules(rename =>
        {
            rename.RuleFor(r => r.From)
                .NotEmpty()
                .WithMessage("El valor de origen del renombrado es obligatorio.")
                .MaximumLength(VariantDimensionTemplate.NameMaxLength)
                .WithMessage($"El valor de origen no puede superar {VariantDimensionTemplate.NameMaxLength} caracteres.");

            rename.RuleFor(r => r.To)
                .NotEmpty()
                .WithMessage("El valor de destino del renombrado es obligatorio.")
                .MaximumLength(VariantDimensionTemplate.NameMaxLength)
                .WithMessage($"El valor de destino no puede superar {VariantDimensionTemplate.NameMaxLength} caracteres.");
        });
    }
}
