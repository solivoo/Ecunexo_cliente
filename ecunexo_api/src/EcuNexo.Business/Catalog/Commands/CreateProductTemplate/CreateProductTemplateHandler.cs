using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateProductTemplate;

public sealed class CreateProductTemplateHandler
    : ICommandHandler<CreateProductTemplateCommand, CreateProductTemplateResponse>
{
    private readonly IValidator<CreateProductTemplateCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IProductTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;

    public CreateProductTemplateHandler(
        IValidator<CreateProductTemplateCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IProductTemplateRepository templates,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _templates = templates;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateProductTemplateResponse>> Handle(
        CreateProductTemplateCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateProductTemplateResponse>(
                new Error("catalog.product_template.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateProductTemplateResponse>(
                new Error("catalog.product_template.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var exists = await _templates.ExistsByNameAsync(command.TenantId, command.Name, null, ct).ConfigureAwait(false);
        if (exists)
        {
            return Result.Failure<CreateProductTemplateResponse>(
                new Error("catalog.product_template.name.duplicate", $"Ya existe una plantilla de producto con el nombre «{command.Name.Trim()}».", ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var templateResult = ProductTemplate.Create(
            id,
            command.TenantId,
            command.Name,
            command.Description,
            command.HierarchyTreeJson,
            command.IsActive,
            command.CreatedBy);

        if (templateResult.IsFailure)
        {
            return Result.Failure<CreateProductTemplateResponse>(templateResult.Error!);
        }

        await _templates.AddAsync(templateResult.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateProductTemplateResponse(id, command.TenantId));
    }
}
