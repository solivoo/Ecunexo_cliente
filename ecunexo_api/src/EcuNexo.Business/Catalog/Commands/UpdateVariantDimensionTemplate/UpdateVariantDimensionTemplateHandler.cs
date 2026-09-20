using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

public sealed class UpdateVariantDimensionTemplateHandler
    : ICommandHandler<UpdateVariantDimensionTemplateCommand, UpdateVariantDimensionTemplateResponse>
{
    private readonly IValidator<UpdateVariantDimensionTemplateCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateVariantDimensionTemplateHandler(
        IValidator<UpdateVariantDimensionTemplateCommand> validator,
        ITenantRepository tenants,
        IVariantDimensionTemplateRepository templates,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateVariantDimensionTemplateResponse>> Handle(
        UpdateVariantDimensionTemplateCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.update.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var template = await _templates.GetByIdAsync(command.TemplateId, command.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.not_found", "La plantilla de variantes no existe.", ErrorType.NotFound));
        }

        var updateResult = template.Update(
            command.Name,
            command.DimensionType,
            command.PredefinedValuesJson,
            command.UpdatedBy);

        if (updateResult.IsFailure)
        {
            return Result.Failure<UpdateVariantDimensionTemplateResponse>(updateResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new UpdateVariantDimensionTemplateResponse(template.Id, template.TenantId);
    }
}
