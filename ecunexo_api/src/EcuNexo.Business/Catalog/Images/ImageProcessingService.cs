using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace EcuNexo.Business.Catalog.Images;

/// <summary>
/// Servicio de procesamiento de imágenes con SixLabors.ImageSharp para e-commerce.
/// Genera 3 variantes optimizadas en WebP con compresión de alta fidelidad y sanitización de metadatos.
/// </summary>
public sealed class ImageProcessingService : IImageProcessingService
{
    private static readonly WebpEncoder WebpEncoder = new()
    {
        Quality = ImageOptimizationPolicy.WebpQuality,
        FileFormat = WebpFileFormatType.Lossy
    };

    public async Task<Result<ProcessedImageVariants>> ProcessForEcommerceAsync(
        Stream inputStream,
        string fileName,
        string contentType,
        CancellationToken ct = default)
    {
        if (inputStream.CanSeek)
        {
            inputStream.Position = 0;
        }

        using var memoryStream = new MemoryStream();
        await inputStream.CopyToAsync(memoryStream, ct);
        var originalSizeBytes = memoryStream.Length;
        memoryStream.Position = 0;

        Image image;
        try
        {
            image = await Image.LoadAsync(memoryStream, ct);
        }
        catch (Exception ex)
        {
            return Result.Failure<ProcessedImageVariants>(new Error(
                "catalog.item.image.decode_failed",
                $"No fue posible decodificar la imagen: {ex.Message}",
                ErrorType.Validation));
        }

        using (image)
        {
            var origWidth = image.Width;
            var origHeight = image.Height;

            var validation = ImageOptimizationPolicy.ValidateUploadRequest(
                contentType,
                fileName,
                originalSizeBytes,
                origWidth,
                origHeight);

            if (validation.IsFailure)
            {
                return Result.Failure<ProcessedImageVariants>(validation.Error!);
            }

            // Sanitizar metadatos EXIF / IPTC / XMP para reducir peso y proteger privacidad
            image.Metadata.ExifProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            var thumbBytes = await CreateVariantAsync(image, ImageOptimizationPolicy.ThumbMaxDimension, ct);
            var mediumBytes = await CreateVariantAsync(image, ImageOptimizationPolicy.MediumMaxDimension, ct);
            var largeBytes = await CreateVariantAsync(image, ImageOptimizationPolicy.LargeMaxDimension, ct);

            var dimensions = new ImageDimensions(origWidth, origHeight);

            return Result.Success(new ProcessedImageVariants(
                OriginalDimensions: dimensions,
                OriginalFileSizeBytes: originalSizeBytes,
                ThumbBytes: thumbBytes,
                MediumBytes: mediumBytes,
                LargeBytes: largeBytes));
        }
    }

    private static async Task<byte[]> CreateVariantAsync(Image original, int targetMaxDimension, CancellationToken ct)
    {
        using var clone = original.Clone(ctx =>
        {
            if (original.Width > targetMaxDimension || original.Height > targetMaxDimension)
            {
                ctx.Resize(new ResizeOptions
                {
                    Size = new Size(targetMaxDimension, targetMaxDimension),
                    Mode = ResizeMode.Max,
                    Sampler = KnownResamplers.Bicubic
                });
            }
        });

        using var ms = new MemoryStream();
        await clone.SaveAsWebpAsync(ms, WebpEncoder, ct);
        return ms.ToArray();
    }

    public async Task<Result<ProcessedEvidencePhoto>> ProcessEvidencePhotoAsync(
        Stream inputStream,
        string fileName,
        string contentType,
        CancellationToken ct = default)
    {
        if (inputStream.CanSeek)
        {
            inputStream.Position = 0;
        }

        using var memoryStream = new MemoryStream();
        await inputStream.CopyToAsync(memoryStream, ct);
        var originalSizeBytes = memoryStream.Length;
        memoryStream.Position = 0;

        // Validar tamaño máximo (15 MB para fotos de celular de alta resolución)
        if (originalSizeBytes > 15 * 1024 * 1024)
        {
            return Result.Failure<ProcessedEvidencePhoto>(new Error(
                "repairs.photo.size_exceeded",
                "La fotografía de evidencia supera el límite máximo permitido de 15 MB.",
                ErrorType.Validation));
        }

        Image image;
        try
        {
            image = await Image.LoadAsync(memoryStream, ct);
        }
        catch (Exception ex)
        {
            return Result.Failure<ProcessedEvidencePhoto>(new Error(
                "repairs.photo.decode_failed",
                $"No fue posible decodificar la fotografía: {ex.Message}",
                ErrorType.Validation));
        }

        using (image)
        {
            // Auto-orientar según giroscopio/EXIF de teléfonos móviles
            image.Mutate(ctx => ctx.AutoOrient());

            // Sanitizar metadatos para optimizar peso y privacidad
            image.Metadata.ExifProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            // Escalar a Full HD (1920px) manteniendo proporciones si la foto es gigantesca
            const int maxEvidenceDimension = 1920;
            if (image.Width > maxEvidenceDimension || image.Height > maxEvidenceDimension)
            {
                image.Mutate(ctx => ctx.Resize(new ResizeOptions
                {
                    Size = new Size(maxEvidenceDimension, maxEvidenceDimension),
                    Mode = ResizeMode.Max,
                    Sampler = KnownResamplers.Bicubic
                }));
            }

            using var webpStream = new MemoryStream();
            await image.SaveAsWebpAsync(webpStream, WebpEncoder, ct);
            var webpBytes = webpStream.ToArray();

            return Result.Success(new ProcessedEvidencePhoto(
                WebpBytes: webpBytes,
                ContentType: "image/webp",
                Width: image.Width,
                Height: image.Height,
                OriginalFileSizeBytes: originalSizeBytes));
        }
    }
}
