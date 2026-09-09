using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.SoftDeleteCategory;

public sealed class SoftDeleteCategoryHandler
    : ICommandHandler<SoftDeleteCategoryCommand, SoftDeleteCategoryResponse>
{
    private readonly ICategoryRepository _categories;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICallerContext _caller;

    public SoftDeleteCategoryHandler(
        ICategoryRepository categories,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork,
        ICallerContext caller)
    {
        _categories = categories;
        _items = items;
        _unitOfWork = unitOfWork;
        _caller = caller;
    }

    public async Task<Result<SoftDeleteCategoryResponse>> Handle(
        SoftDeleteCategoryCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty || command.CategoryId == Guid.Empty)
        {
            return Result.Failure<SoftDeleteCategoryResponse>(
                new Error(
                    "catalog.category.delete.validation",
                    "Tenant y categoría son obligatorios.",
                    ErrorType.Validation));
        }

        var category = await _categories
            .GetTrackedByIdAsync(command.TenantId, command.CategoryId, ct)
            .ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<SoftDeleteCategoryResponse>(
                new Error("catalog.category.not_found", "La categoría no existe.", ErrorType.NotFound));
        }

        var hasChildren = await _categories
            .HasActiveChildrenAsync(command.TenantId, command.CategoryId, ct)
            .ConfigureAwait(false);
        var hasItems = await _items
            .ExistsForCategoryAsync(command.TenantId, command.CategoryId, ct)
            .ConfigureAwait(false);

        if (hasChildren || hasItems)
        {
            var reasons = new List<string>();
            if (hasChildren)
            {
                reasons.Add("subcategorías");
            }

            if (hasItems)
            {
                reasons.Add("ítems asociados");
            }

            return Result.Failure<SoftDeleteCategoryResponse>(
                new Error(
                    "catalog.category.delete.in_use",
                    $"No se puede eliminar: la categoría tiene {string.Join(" y ", reasons)}. "
                    + "Reasigna o elimina esos registros primero, o edita la categoría.",
                    ErrorType.Conflict));
        }

        var deleted = category.SoftDelete(DateTimeOffset.UtcNow, _caller.UserId);
        if (deleted.IsFailure)
        {
            return Result.Failure<SoftDeleteCategoryResponse>(deleted.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SoftDeleteCategoryResponse(category.Id, category.TenantId));
    }
}
