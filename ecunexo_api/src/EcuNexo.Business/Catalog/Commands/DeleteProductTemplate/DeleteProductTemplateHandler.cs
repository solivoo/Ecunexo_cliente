using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.DeleteProductTemplate;

public sealed class DeleteProductTemplateHandler
    : ICommandHandler<DeleteProductTemplateCommand, DeleteProductTemplateResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly IProductTemplateRepository _templates;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteProductTemplateHandler(
        ITenantRepository tenants,
        IProductTemplateRepository templates,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _tenants = tenants;
        _templates = templates;
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteProductTemplateResponse>> Handle(
        DeleteProductTemplateCommand command,
        CancellationToken ct)
    {
        if (command.TemplateId == Guid.Empty)
        {
            return Result.Failure<DeleteProductTemplateResponse>(
                new Error("catalog.product_template.id.invalid", "El id de la plantilla es obligatorio.", ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<DeleteProductTemplateResponse>(
                new Error("catalog.product_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var template = await _templates.GetByIdAsync(command.TemplateId, command.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<DeleteProductTemplateResponse>(
                new Error("catalog.product_template.not_found", "La plantilla de producto no existe.", ErrorType.NotFound));
        }

        var usage = await _items.CountItemsByFamilyAsync(command.TenantId, ct).ConfigureAwait(false);
        if (usage.TryGetValue(template.Id, out var usageCount) && usageCount > 0)
        {
            return Result.Failure<DeleteProductTemplateResponse>(
                new Error(
                    "catalog.product_template.delete.in_use",
                    $"No se puede eliminar la plantilla «{template.Name}» porque {usageCount} producto(s) del catálogo la usan.",
                    ErrorType.Conflict));
        }

        await _templates.DeleteAsync(template, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new DeleteProductTemplateResponse(template.Id, template.TenantId);
    }
}
