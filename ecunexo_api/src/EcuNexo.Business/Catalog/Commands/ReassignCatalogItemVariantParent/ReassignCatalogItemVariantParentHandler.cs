using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Catalog.Commands.ReassignCatalogItemVariantParent;

public sealed class ReassignCatalogItemVariantParentHandler
    : ICommandHandler<ReassignCatalogItemVariantParentCommand, ReassignCatalogItemVariantParentResponse>
{
    private readonly IValidator<ReassignCatalogItemVariantParentCommand> _validator;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public ReassignCatalogItemVariantParentHandler(
        IValidator<ReassignCatalogItemVariantParentCommand> validator,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReassignCatalogItemVariantParentResponse>> Handle(
        ReassignCatalogItemVariantParentCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ReassignCatalogItemVariantParentResponse>(
                new Error("catalog.variant.reassign.validation", message, ErrorType.Validation));
        }

        var variant = await _items.GetTrackedByIdAsync(command.TenantId, command.VariantItemId, ct).ConfigureAwait(false);
        if (variant is null)
        {
            return Result.Failure<ReassignCatalogItemVariantParentResponse>(
                new Error("catalog.variant.not_found", "La variante indicada no existe.", ErrorType.NotFound));
        }

        CatalogItem? targetParent = null;
        if (command.TargetParentItemId.HasValue)
        {
            targetParent = await _items.GetTrackedByIdAsync(command.TenantId, command.TargetParentItemId.Value, ct).ConfigureAwait(false);
            if (targetParent is null)
            {
                return Result.Failure<ReassignCatalogItemVariantParentResponse>(
                    new Error("catalog.matrix.target_not_found", "El producto matriz destino no existe.", ErrorType.NotFound));
            }
        }

        CatalogItem? previousParent = null;
        if (variant.ParentId.HasValue)
        {
            previousParent = await _items.GetTrackedByIdAsync(command.TenantId, variant.ParentId.Value, ct).ConfigureAwait(false);
        }

        var previousParentId = variant.ParentId;
        var reassignResult = variant.ReassignParent(
            targetParent,
            command.Reason,
            previousParent,
            command.CurrentUserId,
            DateTimeOffset.UtcNow);

        if (reassignResult.IsFailure)
        {
            return Result.Failure<ReassignCatalogItemVariantParentResponse>(reassignResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new ReassignCatalogItemVariantParentResponse(
            variant.Id,
            previousParentId,
            variant.ParentId,
            command.Reason.Trim(),
            variant.Sku ?? string.Empty,
            variant.Name));
    }
}
