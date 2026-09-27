using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Images;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.UploadTenantMedia;

public sealed class UploadTenantMediaHandler
    : ICommandHandler<UploadTenantMediaCommand, TenantMediaResponse>
{
    private readonly IImageProcessingService _imageProcessor;
    private readonly IStorageService _storage;

    public UploadTenantMediaHandler(
        IImageProcessingService imageProcessor,
        IStorageService storage)
    {
        _imageProcessor = imageProcessor;
        _storage = storage;
    }

    public async Task<Result<TenantMediaResponse>> Handle(
        UploadTenantMediaCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<TenantMediaResponse>(
                new Error("catalog.media.tenant.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        var processResult = await _imageProcessor.ProcessForEcommerceAsync(
            command.FileStream,
            command.FileName,
            command.ContentType,
            ct).ConfigureAwait(false);

        if (processResult.IsFailure)
        {
            return Result.Failure<TenantMediaResponse>(processResult.Error!);
        }

        var variants = processResult.Value;
        var mediaId = Guid.CreateVersion7();
        var basePath = $"tenants/{command.TenantId:N}/media/{mediaId:N}";
        var thumbKey = $"{basePath}_thumb.webp";
        var mediumKey = $"{basePath}_medium.webp";
        var largeKey = $"{basePath}_large.webp";

        using var thumbMs = new MemoryStream(variants.ThumbBytes);
        using var mediumMs = new MemoryStream(variants.MediumBytes);
        using var largeMs = new MemoryStream(variants.LargeBytes);

        var thumbTask = _storage.UploadPublicAsync(thumbKey, thumbMs, ImageOptimizationPolicy.CanonicalMimeType, ct);
        var mediumTask = _storage.UploadPublicAsync(mediumKey, mediumMs, ImageOptimizationPolicy.CanonicalMimeType, ct);
        var largeTask = _storage.UploadPublicAsync(largeKey, largeMs, ImageOptimizationPolicy.CanonicalMimeType, ct);

        string thumbUrl;
        string mediumUrl;
        string largeUrl;

        try
        {
            await Task.WhenAll(thumbTask, mediumTask, largeTask).ConfigureAwait(false);
            thumbUrl = await thumbTask.ConfigureAwait(false);
            mediumUrl = await mediumTask.ConfigureAwait(false);
            largeUrl = await largeTask.ConfigureAwait(false);
        }
        catch (Amazon.S3.AmazonS3Exception s3Ex)
        {
            return Result.Failure<TenantMediaResponse>(new Error(
                "catalog.media.storage_error",
                $"Error de comunicación con el almacenamiento: {s3Ex.Message}.",
                ErrorType.Validation));
        }
        catch (Exception ex)
        {
            return Result.Failure<TenantMediaResponse>(new Error(
                "catalog.media.storage_error",
                ex.Message,
                ErrorType.Validation));
        }

        return Result.Success(new TenantMediaResponse(
            largeKey,
            thumbUrl,
            mediumUrl,
            largeUrl,
            variants.OriginalDimensions.Width,
            variants.OriginalDimensions.Height,
            variants.OriginalFileSizeBytes));
    }
}
