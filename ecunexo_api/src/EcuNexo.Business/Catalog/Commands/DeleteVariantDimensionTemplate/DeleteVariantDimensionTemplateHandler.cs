using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.DeleteVariantDimensionTemplate;

public sealed class DeleteVariantDimensionTemplateHandler
    : ICommandHandler<DeleteVariantDimensionTemplateCommand, DeleteVariantDimensionTemplateResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly IVariantDimensionTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteVariantDimensionTemplateHandler(
        ITenantRepository tenants,
        IVariantDimensionTemplateRepository templates,
        IUnitOfWork unitOfWork)
    {
        _tenants = tenants;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteVariantDimensionTemplateResponse>> Handle(
        DeleteVariantDimensionTemplateCommand command,
        CancellationToken ct)
    {
        if (command.TemplateId == Guid.Empty)
        {
            return Result.Failure<DeleteVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.id.invalid", "El id de la plantilla es obligatorio.", ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<DeleteVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var template = await _templates.GetByIdAsync(command.TemplateId, command.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<DeleteVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.not_found", "La plantilla de variantes no existe.", ErrorType.NotFound));
        }

        if (template.IsSystemDefault)
        {
            return Result.Failure<DeleteVariantDimensionTemplateResponse>(
                new Error("catalog.variant_template.system.cannot_delete", "Las plantillas predeterminadas del sistema no pueden eliminarse.", ErrorType.Conflict));
        }

        await _templates.DeleteAsync(template, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new DeleteVariantDimensionTemplateResponse(template.Id, template.TenantId);
    }
}
