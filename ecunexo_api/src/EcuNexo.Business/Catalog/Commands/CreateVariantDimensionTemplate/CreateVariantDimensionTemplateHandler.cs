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

        var systemConflict = SystemBaseAttributes.FindItemFieldByNameOrAlias(command.Name);
        if (systemConflict is not null)
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.system_base_conflict",
                    $"«{systemConflict.Name}» ya existe como atributo base del sistema en todos los ítems. No es necesario crearlo de nuevo.",
                    ErrorType.Validation));
        }

        var dataTypeNorm = (command.DataType ?? string.Empty).Trim().ToLowerInvariant();
        var dimensionTypeNorm = (command.DimensionType ?? string.Empty).Trim().ToLowerInvariant();
        var isColorKind =
            dataTypeNorm is VariantDimensionTemplate.DataTypeColor or VariantDimensionTemplate.DataTypeColorList
            || dimensionTypeNorm == "color";
        var systemColor = SystemBaseAttributes.FindByNameOrAlias(command.Name);
        var isSystemColorOverlay =
            systemColor is not null
            && string.Equals(systemColor.Id, "system-colors", StringComparison.Ordinal);

        if (isColorKind && !isSystemColorOverlay)
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.color.system_only",
                    "Los colores se gestionan solo en el atributo Color base del sistema (nombre + hex). No se pueden crear atributos de color adicionales.",
                    ErrorType.Validation));
        }

        if (isSystemColorOverlay
            && await _templates.ExistsByNameAsync(command.TenantId, systemColor!.Name, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.color.overlay_exists",
                    "El Color del sistema ya tiene paleta en este tenant. Actualiza sus valores en lugar de crear otro.",
                    ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var templateResult = VariantDimensionTemplate.Create(
            id,
            command.TenantId,
            isSystemColorOverlay ? systemColor!.Name : command.Name,
            isSystemColorOverlay ? "color" : (command.DimensionType ?? "custom"),
            command.PredefinedValuesJson,
            isSystemColorOverlay
                ? VariantDimensionTemplate.DataTypeColor
                : (command.DataType ?? VariantDimensionTemplate.DataTypeText),
            isSystemColorOverlay || command.IsVariantAxis,
            isSystemColorOverlay ? null : command.Unit);

        if (templateResult.IsFailure)
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(templateResult.Error!);
        }

        await _templates.AddAsync(templateResult.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateVariantDimensionTemplateResponse(id, command.TenantId));
    }
}
