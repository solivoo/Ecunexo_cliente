using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;

public sealed class UpdateVariantDimensionTemplateHandler
    : ICommandHandler<UpdateVariantDimensionTemplateCommand, UpdateVariantDimensionTemplateResponse>
{
    private readonly IValidator<UpdateVariantDimensionTemplateCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateVariantDimensionTemplateHandler(
        IValidator<UpdateVariantDimensionTemplateCommand> validator,
        ITenantRepository tenants,
        IVariantDimensionTemplateRepository templates,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _templates = templates;
        _items = items;
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

        var oldName = template.Name;
        var oldValues = ParsePredefinedValues(template.PredefinedValuesJson);
        var oldDataType = template.DataType;
        var oldIsVariantAxis = template.IsVariantAxis;
        var oldDimensionType = template.DimensionType;

        var targetName = command.Name.Trim();
        var nameChanged = !string.Equals(oldName, targetName, StringComparison.OrdinalIgnoreCase);
        if (nameChanged)
        {
            var duplicate = await _templates.ExistsByNameAsync(command.TenantId, targetName, template.Id, ct)
                .ConfigureAwait(false);
            if (duplicate)
            {
                return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                    new Error(
                        "catalog.variant_template.name.duplicate",
                        $"Ya existe un atributo llamado «{targetName}».",
                        ErrorType.Conflict));
            }
        }

        var valueRenames = command.ValueRenames ?? [];
        foreach (var rename in valueRenames)
        {
            var from = rename.From?.Trim() ?? string.Empty;
            var to = rename.To?.Trim() ?? string.Empty;
            if (from.Length == 0
                || to.Length == 0
                || from.Equals(to, StringComparison.OrdinalIgnoreCase))
            {
                return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                    new Error(
                        "catalog.variant_template.value_rename.invalid",
                        "Cada renombrado de opción debe indicar un valor de origen y uno de destino distintos.",
                        ErrorType.Validation));
            }
        }

        var updateResult = template.Update(
            command.Name,
            command.DimensionType,
            command.PredefinedValuesJson,
            command.DataType,
            command.IsVariantAxis,
            command.Unit,
            command.UpdatedBy);

        if (updateResult.IsFailure)
        {
            return Result.Failure<UpdateVariantDimensionTemplateResponse>(updateResult.Error!);
        }

        var typeChanged = !string.Equals(oldDataType, template.DataType, StringComparison.OrdinalIgnoreCase)
            || oldIsVariantAxis != template.IsVariantAxis
            || !string.Equals(oldDimensionType, template.DimensionType, StringComparison.OrdinalIgnoreCase);

        if (typeChanged)
        {
            var isInUse = await _items.IsAttributeTemplateInUseAsync(command.TenantId, oldName, ct)
                .ConfigureAwait(false);
            if (isInUse)
            {
                return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                    new Error(
                        "catalog.variant_template.type.in_use",
                        $"No se puede cambiar el tipo de «{oldName}» porque está asociado a productos del catálogo. Crea un nuevo atributo y reasigna los productos al nuevo.",
                        ErrorType.Conflict));
            }
        }

        var newValues = ParsePredefinedValues(template.PredefinedValuesJson);
        foreach (var rename in valueRenames)
        {
            var from = rename.From.Trim();
            var to = rename.To.Trim();
            if (from.Equals(to, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var fromExists = oldValues.Any(v => v.Equals(from, StringComparison.OrdinalIgnoreCase));
            var toExists = newValues.Any(v => v.Equals(to, StringComparison.OrdinalIgnoreCase));
            if (!fromExists || !toExists)
            {
                return Result.Failure<UpdateVariantDimensionTemplateResponse>(
                    new Error(
                        "catalog.variant_template.value_rename.invalid",
                        $"No se puede renombrar «{from}» a «{to}»: los valores no coinciden con el atributo.",
                        ErrorType.Validation));
            }
        }

        var affectedItems = new HashSet<Guid>();
        if (nameChanged)
        {
            affectedItems.UnionWith(
                await _items
                    .RenameAttributeKeyAsync(command.TenantId, oldName, template.Name, command.UpdatedBy, ct)
                    .ConfigureAwait(false));
        }

        foreach (var rename in valueRenames)
        {
            var from = rename.From.Trim();
            var to = rename.To.Trim();
            if (from.Equals(to, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            affectedItems.UnionWith(
                await _items
                    .RenameAttributeValueAsync(
                        command.TenantId,
                        template.Name,
                        from,
                        to,
                        template.DataType is VariantDimensionTemplate.DataTypeMultiSelect
                            or VariantDimensionTemplate.DataTypeColorList,
                        template.IsVariantAxis,
                        command.UpdatedBy,
                        ct)
                    .ConfigureAwait(false));
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new UpdateVariantDimensionTemplateResponse(template.Id, template.TenantId, affectedItems.Count);
    }

    private static List<string> ParsePredefinedValues(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            return doc.RootElement
                .EnumerateArray()
                .Where(el => el.ValueKind == JsonValueKind.String)
                .Select(el => el.GetString() ?? string.Empty)
                .Where(value => value.Length > 0)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
