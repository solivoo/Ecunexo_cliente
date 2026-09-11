using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.SetCatalogItemMainImage;

public sealed class SetCatalogItemMainImageHandler : ICommandHandler<SetCatalogItemMainImageCommand, SetCatalogItemMainImageResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public SetCatalogItemMainImageHandler(ICatalogItemRepository items, IUnitOfWork unitOfWork)
    {
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SetCatalogItemMainImageResponse>> Handle(SetCatalogItemMainImageCommand command, CancellationToken ct)
    {
        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<SetCatalogItemMainImageResponse>(
                new Error("catalog.item.not_found", "El producto especificado no existe.", ErrorType.NotFound));
        }

        var result = item.SetMainImage(command.ImageId, command.UserId);
        if (result.IsFailure)
        {
            return Result.Failure<SetCatalogItemMainImageResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SetCatalogItemMainImageResponse(command.ImageId));
    }
}
