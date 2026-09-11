using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.DeleteCatalogItemImage;

public sealed class DeleteCatalogItemImageHandler : ICommandHandler<DeleteCatalogItemImageCommand, DeleteCatalogItemImageResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IStorageService _storage;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteCatalogItemImageHandler(
        ICatalogItemRepository items,
        IStorageService storage,
        IUnitOfWork unitOfWork)
    {
        _items = items;
        _storage = storage;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteCatalogItemImageResponse>> Handle(DeleteCatalogItemImageCommand command, CancellationToken ct)
    {
        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<DeleteCatalogItemImageResponse>(
                new Error("catalog.item.not_found", "El producto especificado no existe.", ErrorType.NotFound));
        }

        var image = item.Images.FirstOrDefault(i => i.Id == command.ImageId);
        if (image is null)
        {
            return Result.Failure<DeleteCatalogItemImageResponse>(
                new Error("catalog.item.image.not_found", "La imagen indicada no existe en este producto.", ErrorType.NotFound));
        }

        var removeResult = item.RemoveImage(command.ImageId, command.UserId);
        if (removeResult.IsFailure)
        {
            return Result.Failure<DeleteCatalogItemImageResponse>(removeResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        // Limpiar objetos de almacenamiento en segundo plano de forma no bloqueante
        var basePath = $"tenants/{command.TenantId:N}/catalog/items/{command.ItemId:N}";
        var thumbKey = $"{basePath}/{command.ImageId:N}_thumb.webp";
        var mediumKey = $"{basePath}/{command.ImageId:N}_medium.webp";
        var largeKey = $"{basePath}/{command.ImageId:N}_large.webp";

        try
        {
            await Task.WhenAll(
                _storage.DeleteAsync(_storage.PublicBucket, thumbKey, ct),
                _storage.DeleteAsync(_storage.PublicBucket, mediumKey, ct),
                _storage.DeleteAsync(_storage.PublicBucket, largeKey, ct)).ConfigureAwait(false);
        }
        catch
        {
            // Falla no crítica de limpieza S3: el registro en BD ya se removió consistentemente
        }

        return Result.Success(new DeleteCatalogItemImageResponse(command.ImageId));
    }
}
