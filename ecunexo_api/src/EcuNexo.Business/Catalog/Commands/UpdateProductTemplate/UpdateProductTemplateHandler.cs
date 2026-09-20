using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateProductTemplate;

public sealed class UpdateProductTemplateHandler
    : ICommandHandler<UpdateProductTemplateCommand, UpdateProductTemplateResponse>
{
    private readonly IValidator<UpdateProductTemplateCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IProductTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateProductTemplateHandler(
        IValidator<UpdateProductTemplateCommand> validator,
        ITenantRepository tenants,
        IProductTemplateRepository templates,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateProductTemplateResponse>> Handle(
        UpdateProductTemplateCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateProductTemplateResponse>(
                new Error("catalog.product_template.update.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<UpdateProductTemplateResponse>(
                new Error("catalog.product_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var template = await _templates.GetByIdAsync(command.TemplateId, command.TenantId, ct)
            .ConfigureAwait(false);

        if (template is null)
        {
            return Result.Failure<UpdateProductTemplateResponse>(
                new Error("catalog.product_template.not_found", "La plantilla de producto no existe.", ErrorType.NotFound));
        }

        var exists = await _templates.ExistsByNameAsync(command.TenantId, command.Name, command.TemplateId, ct)
            .ConfigureAwait(false);
        if (exists)
        {
            return Result.Failure<UpdateProductTemplateResponse>(
                new Error("catalog.product_template.name.duplicate", $"Ya existe otra plantilla con el nombre «{command.Name.Trim()}».", ErrorType.Conflict));
        }

        var updateResult = template.Update(
            command.Name,
            command.Description,
            command.HierarchyTreeJson,
            command.IsActive,
            command.UpdatedBy);

        if (updateResult.IsFailure)
        {
            return Result.Failure<UpdateProductTemplateResponse>(updateResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new UpdateProductTemplateResponse(template.Id, template.TenantId);
    }
}
