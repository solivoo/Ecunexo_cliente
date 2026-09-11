using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.UpdateCatalogItemImageAltText;

public sealed class UpdateCatalogItemImageAltTextHandler : ICommandHandler<UpdateCatalogItemImageAltTextCommand, UpdateCatalogItemImageAltTextResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCatalogItemImageAltTextHandler(ICatalogItemRepository items, IUnitOfWork unitOfWork)
    {
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateCatalogItemImageAltTextResponse>> Handle(UpdateCatalogItemImageAltTextCommand command, CancellationToken ct)
    {
        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<UpdateCatalogItemImageAltTextResponse>(
                new Error("catalog.item.not_found", "El producto especificado no existe.", ErrorType.NotFound));
        }

        var result = item.UpdateImageAltText(command.ImageId, command.AltText, command.UserId);
        if (result.IsFailure)
        {
            return Result.Failure<UpdateCatalogItemImageAltTextResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateCatalogItemImageAltTextResponse(command.ImageId, command.AltText));
    }
}
