using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.CreateCategory;

public sealed class CreateCategoryHandler : ICommandHandler<CreateCategoryCommand, CreateCategoryResponse>
{
    private readonly IValidator<CreateCategoryCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly ICategoryRepository _categories;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCategoryHandler(
        IValidator<CreateCategoryCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        ICategoryRepository categories,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _categories = categories;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateCategoryResponse>> Handle(
        CreateCategoryCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateCategoryResponse>(
                new Error("catalog.category.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCategoryResponse>(
                new Error("catalog.category.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        if (command.ParentId is { } parentId
            && !await _categories.ExistsActiveByIdAsync(command.TenantId, parentId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateCategoryResponse>(
                new Error("catalog.category.parent.not_found", "La categoría padre no existe.", ErrorType.NotFound));
        }

        if (await _categories.NameExistsIgnoreCaseAsync(command.TenantId, command.Name, null, ct)
            .ConfigureAwait(false))
        {
            return Result.Failure<CreateCategoryResponse>(
                new Error(
                    "catalog.category.name.duplicate",
                    "Ya existe una categoría con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var created = Category.Create(
            id,
            command.TenantId,
            command.Name,
            command.Description,
            command.ParentId,
            command.AttributeSchemaJson);
        if (created.IsFailure)
        {
            return Result.Failure<CreateCategoryResponse>(created.Error!);
        }

        await _categories.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateCategoryResponse(created.Value!.Id, created.Value.TenantId));
    }
}
