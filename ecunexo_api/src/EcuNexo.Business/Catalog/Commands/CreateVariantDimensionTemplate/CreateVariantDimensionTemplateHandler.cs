using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateVariantDimensionTemplate;

public sealed class CreateVariantDimensionTemplateHandler
    : ICommandHandler<CreateVariantDimensionTemplateCommand, CreateVariantDimensionTemplateResponse>
{
    private readonly IValidator<CreateVariantDimensionTemplateCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;

    public CreateVariantDimensionTemplateHandler(
        IValidator<CreateVariantDimensionTemplateCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IVariantDimensionTemplateRepository templates,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateVariantDimensionTemplateResponse>> Handle(
        CreateVariantDimensionTemplateCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var id = _idGenerator.NewId();
        var templateResult = VariantDimensionTemplate.Create(
            id,
            command.TenantId,
            command.Name,
            command.DimensionType,
            command.PredefinedValuesJson,
            command.DataType,
            command.IsVariantAxis,
            command.Unit,
            isSystemDefault: false);

        if (templateResult.IsFailure)
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(templateResult.Error!);
        }

        await _templates.AddAsync(templateResult.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateVariantDimensionTemplateResponse(id, command.TenantId));
    }
}
