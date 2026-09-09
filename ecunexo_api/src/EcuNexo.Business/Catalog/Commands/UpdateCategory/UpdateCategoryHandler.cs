using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.UpdateCategory;

public sealed class UpdateCategoryHandler : ICommandHandler<UpdateCategoryCommand, UpdateCategoryResponse>
{
    private readonly IValidator<UpdateCategoryCommand> _validator;
    private readonly ICategoryRepository _categories;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCategoryHandler(
        IValidator<UpdateCategoryCommand> validator,
        ICategoryRepository categories,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _categories = categories;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateCategoryResponse>> Handle(
        UpdateCategoryCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateCategoryResponse>(
                new Error("catalog.category.update.validation", message, ErrorType.Validation));
        }

        var category = await _categories
            .GetTrackedByIdAsync(command.TenantId, command.CategoryId, ct)
            .ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<UpdateCategoryResponse>(
                new Error("catalog.category.not_found", "La categoría no existe.", ErrorType.NotFound));
        }

        if (command.ParentId is { } parentId)
        {
            if (parentId == command.CategoryId)
            {
                return Result.Failure<UpdateCategoryResponse>(
                    new Error(
                        "catalog.category.parent.self",
                        "Una categoría no puede ser padre de sí misma.",
                        ErrorType.Validation));
            }

            if (!await _categories.ExistsActiveByIdAsync(command.TenantId, parentId, ct).ConfigureAwait(false))
            {
                return Result.Failure<UpdateCategoryResponse>(
                    new Error("catalog.category.parent.not_found", "La categoría padre no existe.", ErrorType.NotFound));
            }
        }

        if (await _categories
                .NameExistsIgnoreCaseAsync(command.TenantId, command.Name, command.CategoryId, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure<UpdateCategoryResponse>(
                new Error(
                    "catalog.category.name.duplicate",
                    "Ya existe una categoría con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var renamed = category.Rename(command.Name, command.Description, updatedBy: null);
        if (renamed.IsFailure)
        {
            return Result.Failure<UpdateCategoryResponse>(renamed.Error!);
        }

        var parent = category.SetParent(command.ParentId, updatedBy: null);
        if (parent.IsFailure)
        {
            return Result.Failure<UpdateCategoryResponse>(parent.Error!);
        }

        var schema = category.SetAttributeSchema(command.AttributeSchemaJson, updatedBy: null);
        if (schema.IsFailure)
        {
            return Result.Failure<UpdateCategoryResponse>(schema.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateCategoryResponse(category.Id, category.TenantId));
    }
}
