using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.ReorderCatalogItemVariants;

public sealed record ReorderCatalogItemVariantsCommand(
    Guid TenantId,
    Guid ParentItemId,
    IReadOnlyList<Guid> VariantIds) : ICommand<ReorderCatalogItemVariantsResponse>;

public sealed record ReorderCatalogItemVariantsResponse(
    Guid ParentItemId,
    int VariantsCount);

public sealed class ReorderCatalogItemVariantsHandler
    : ICommandHandler<ReorderCatalogItemVariantsCommand, ReorderCatalogItemVariantsResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public ReorderCatalogItemVariantsHandler(
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReorderCatalogItemVariantsResponse>> Handle(
        ReorderCatalogItemVariantsCommand command,
        CancellationToken ct)
    {
        var parent = await _items
            .GetTrackedByIdAsync(command.TenantId, command.ParentItemId, ct)
            .ConfigureAwait(false);
        if (parent is null)
        {
            return Result.Failure<ReorderCatalogItemVariantsResponse>(
                new Error("catalog.item.not_found", "El producto no existe.", ErrorType.NotFound));
        }

        if (!parent.IsMatrixParent)
        {
            return Result.Failure<ReorderCatalogItemVariantsResponse>(
                new Error(
                    "catalog.item.not_matrix_parent",
                    "El ítem seleccionado no es un producto matriz.",
                    ErrorType.Validation));
        }

        var variants = parent.Variants
            .Where(v => v.DeletedAt == null)
            .ToDictionary(v => v.Id);

        if (command.VariantIds.Count != variants.Count
            || command.VariantIds.Distinct().Count() != command.VariantIds.Count
            || command.VariantIds.Any(id => !variants.ContainsKey(id)))
        {
            return Result.Failure<ReorderCatalogItemVariantsResponse>(
                new Error(
                    "catalog.item.variants.order.invalid",
                    "La lista debe incluir todas las variantes del producto, sin repetidos.",
                    ErrorType.Validation));
        }

        for (var index = 0; index < command.VariantIds.Count; index++)
        {
            var updated = variants[command.VariantIds[index]].SetSortOrder(index);
            if (updated.IsFailure)
            {
                return Result.Failure<ReorderCatalogItemVariantsResponse>(updated.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new ReorderCatalogItemVariantsResponse(parent.Id, command.VariantIds.Count);
    }
}
