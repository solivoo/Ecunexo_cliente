using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.ReorderCatalogItemImages;

public sealed class ReorderCatalogItemImagesHandler : ICommandHandler<ReorderCatalogItemImagesCommand, ReorderCatalogItemImagesResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public ReorderCatalogItemImagesHandler(ICatalogItemRepository items, IUnitOfWork unitOfWork)
    {
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReorderCatalogItemImagesResponse>> Handle(ReorderCatalogItemImagesCommand command, CancellationToken ct)
    {
        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<ReorderCatalogItemImagesResponse>(
                new Error("catalog.item.not_found", "El producto especificado no existe.", ErrorType.NotFound));
        }

        var result = item.ReorderImages(command.OrderedImageIds, command.UserId);
        if (result.IsFailure)
        {
            return Result.Failure<ReorderCatalogItemImagesResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new ReorderCatalogItemImagesResponse(command.OrderedImageIds));
    }
}
