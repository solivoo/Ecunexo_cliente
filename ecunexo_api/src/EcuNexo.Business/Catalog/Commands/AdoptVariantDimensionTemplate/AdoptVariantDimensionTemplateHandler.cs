using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.AdoptVariantDimensionTemplate;

public sealed class AdoptVariantDimensionTemplateHandler
    : ICommandHandler<AdoptVariantDimensionTemplateCommand, AdoptVariantDimensionTemplateResponse>
{
    private readonly IValidator<AdoptVariantDimensionTemplateCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public AdoptVariantDimensionTemplateHandler(
        IValidator<AdoptVariantDimensionTemplateCommand> validator,
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

    public async Task<Result<AdoptVariantDimensionTemplateResponse>> Handle(
        AdoptVariantDimensionTemplateCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<AdoptVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.adopt.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<AdoptVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var template = await _templates.GetByIdAsync(command.TemplateId, command.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<AdoptVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.not_found", "La plantilla de variantes no existe.", ErrorType.NotFound));
        }

        var source = command.SourceAttributeName.Trim();
        if (source.Equals(template.Name, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure<AdoptVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.adopt.same",
                    "El atributo de origen y el nuevo atributo deben ser distintos.",
                    ErrorType.Validation));
        }

        var isInUse = await _items.IsAttributeTemplateInUseAsync(command.TenantId, source, ct)
            .ConfigureAwait(false);
        if (!isInUse)
        {
            return Result.Failure<AdoptVariantDimensionTemplateResponse>(
                new Error(
                    "catalog.variant_template.adopt.source_not_in_use",
                    $"El atributo «{source}» no tiene productos asociados para reasignar.",
                    ErrorType.NotFound));
        }

        var affected = await _items
            .RenameAttributeKeyAsync(command.TenantId, source, template.Name, command.UpdatedBy, ct)
            .ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new AdoptVariantDimensionTemplateResponse(
            template.Id,
            template.TenantId,
            source,
            affected.Count);
    }
}
