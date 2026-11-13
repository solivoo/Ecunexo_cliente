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

        var systemListOverlay = systemColor is not null && !isSystemColorOverlay ? systemColor : null;
        if (systemListOverlay is not null)
        {
            var removed = SystemBaseAttributes.FirstRemovedCanonicalValue(
                systemListOverlay,
                command.PredefinedValuesJson);
            if (removed is not null)
            {
                return Result.Failure<CreateVariantDimensionTemplateResponse>(
                    new Error(
                        "catalog.variant_template.system_base.value_removed",
                        $"No se puede quitar «{removed}»: es una opción base del sistema. Puedes agregar opciones nuevas.",
                        ErrorType.Validation));
            }
        }

        if ((isSystemColorOverlay || systemListOverlay is not null)
            && await _templates.ExistsByNameAsync(command.TenantId, systemColor!.Name, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.system_base.overlay_exists",
                    $"«{systemColor.Name}» ya tiene valores en este tenant. Actualízalos en lugar de crear otro atributo.",
                    ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var templateResult = VariantDimensionTemplate.Create(
            id,
            command.TenantId,
            systemColor is not null ? systemColor.Name : command.Name,
            isSystemColorOverlay
                ? "color"
                : systemListOverlay is not null
                    ? systemListOverlay.DimensionType
                    : (command.DimensionType ?? "custom"),
            command.PredefinedValuesJson,
            isSystemColorOverlay
                ? VariantDimensionTemplate.DataTypeColor
                : systemListOverlay is not null
                    ? systemListOverlay.DataType
                    : (command.DataType ?? VariantDimensionTemplate.DataTypeText),
            isSystemColorOverlay || (systemListOverlay?.IsVariantAxis ?? false) || command.IsVariantAxis,
            isSystemColorOverlay
                ? null
                : systemListOverlay is not null
                    ? systemListOverlay.Unit
                    : command.Unit);

        if (templateResult.IsFailure)
        {
            return Result.Failure<CreateVariantDimensionTemplateResponse>(templateResult.Error!);
        }

        await _templates.AddAsync(templateResult.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateVariantDimensionTemplateResponse(id, command.TenantId));
    }
}
