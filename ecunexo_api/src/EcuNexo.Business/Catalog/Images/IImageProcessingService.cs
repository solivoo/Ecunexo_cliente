using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Images;

public readonly record struct ProcessedImageVariants(
    ImageDimensions OriginalDimensions,
    long OriginalFileSizeBytes,
    byte[] ThumbBytes,
    byte[] MediumBytes,
    byte[] LargeBytes,
    string ContentType = ImageOptimizationPolicy.CanonicalMimeType);

public readonly record struct ProcessedEvidencePhoto(
    byte[] WebpBytes,
    string ContentType,
    int Width,
    int Height,
    long OriginalFileSizeBytes);

public interface IImageProcessingService
{
    /// <summary>
    /// Procesa una imagen entrante, valida sus dimensiones y formato, y genera las 3 variantes e-commerce en formato WebP optimizado.
    /// </summary>
    Task<Result<ProcessedImageVariants>> ProcessForEcommerceAsync(
        Stream inputStream,
        string fileName,
        string contentType,
        CancellationToken ct = default);

    /// <summary>
    /// Procesa una fotografía de evidencia de taller/reparación (ej. daño, despiece, control de calidad).
    /// Auto-orienta según EXIF de teléfono móvil, sanitiza metadatos, escala a Full HD si excede 1920px y comprime en WebP optimizado.
    /// </summary>
    Task<Result<ProcessedEvidencePhoto>> ProcessEvidencePhotoAsync(
        Stream inputStream,
        string fileName,
        string contentType,
        CancellationToken ct = default);
}
