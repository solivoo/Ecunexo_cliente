using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Images;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.UploadCatalogItemImage;

public sealed class UploadCatalogItemImageHandler : ICommandHandler<UploadCatalogItemImageCommand, CatalogItemImageResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IImageProcessingService _imageProcessor;
    private readonly IStorageService _storage;
    private readonly IUnitOfWork _unitOfWork;

    public UploadCatalogItemImageHandler(
        ICatalogItemRepository items,
        IImageProcessingService imageProcessor,
        IStorageService storage,
        IUnitOfWork unitOfWork)
    {
        _items = items;
        _imageProcessor = imageProcessor;
        _storage = storage;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CatalogItemImageResponse>> Handle(
        UploadCatalogItemImageCommand command,
        CancellationToken ct)
    {
        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<CatalogItemImageResponse>(
                new Error("catalog.item.not_found", "El producto especificado no existe o fue eliminado.", ErrorType.NotFound));
        }

        if (item.Images.Count >= ImageOptimizationPolicy.MaxImagesPerItem)
        {
            return Result.Failure<CatalogItemImageResponse>(
                new Error("catalog.item.image.limit.exceeded",
                    $"No se pueden agregar más de {ImageOptimizationPolicy.MaxImagesPerItem} imágenes por producto.",
                    ErrorType.Validation));
        }

        // 1. Procesar y optimizar con ImageSharp (genera 3 variantes WebP a calidad 82%)
        var processResult = await _imageProcessor.ProcessForEcommerceAsync(
            command.FileStream,
            command.FileName,
            command.ContentType,
            ct).ConfigureAwait(false);

        if (processResult.IsFailure)
        {
            return Result.Failure<CatalogItemImageResponse>(processResult.Error!);
        }

        var variants = processResult.Value!;
        var imageId = Guid.CreateVersion7();
        var basePath = $"tenants/{command.TenantId:N}/catalog/items/{command.ItemId:N}";
        var thumbKey = $"{basePath}/{imageId:N}_thumb.webp";
        var mediumKey = $"{basePath}/{imageId:N}_medium.webp";
        var largeKey = $"{basePath}/{imageId:N}_large.webp";

        // 2. Subir las 3 variantes concurrentemente a Backblaze B2 (bucket público)
        using var thumbMs = new MemoryStream(variants.ThumbBytes);
        using var mediumMs = new MemoryStream(variants.MediumBytes);
        using var largeMs = new MemoryStream(variants.LargeBytes);

        var thumbTask = _storage.UploadPublicAsync(thumbKey, thumbMs, ImageOptimizationPolicy.CanonicalMimeType, ct);
        var mediumTask = _storage.UploadPublicAsync(mediumKey, mediumMs, ImageOptimizationPolicy.CanonicalMimeType, ct);
        var largeTask = _storage.UploadPublicAsync(largeKey, largeMs, ImageOptimizationPolicy.CanonicalMimeType, ct);

        await Task.WhenAll(thumbTask, mediumTask, largeTask).ConfigureAwait(false);

        var thumbUrl = await thumbTask.ConfigureAwait(false);
        var mediumUrl = await mediumTask.ConfigureAwait(false);
        var largeUrl = await largeTask.ConfigureAwait(false);

        // 3. Invocar invariantes del agregado CatalogItem en DDD
        var addResult = item.AddImage(
            imageId: imageId,
            storageKey: largeKey,
            originalFileName: command.FileName,
            altText: command.AltText,
            dimensions: variants.OriginalDimensions,
            fileSizeBytes: variants.OriginalFileSizeBytes,
            thumbUrl: thumbUrl,
            mediumUrl: mediumUrl,
            largeUrl: largeUrl,
            setAsMain: command.SetAsMain,
            createdBy: command.UserId);

        if (addResult.IsFailure)
        {
            return Result.Failure<CatalogItemImageResponse>(addResult.Error!);
        }

        // 4. Persistir cambios en BD
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(CatalogItemImageResponse.FromEntity(addResult.Value!));
    }
}
