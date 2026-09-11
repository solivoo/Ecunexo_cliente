using EcuNexo.Core.Common;

namespace EcuNexo.Core.Catalog.ValueObjects;

/// <summary>
/// Política de dominio que define las reglas de optimización de imágenes para e-commerce.
/// Regula formatos, pesos máximos, dimensiones, calidad y variantes para optimizar recursos y LCP.
/// </summary>
public static class ImageOptimizationPolicy
{
    public const int MaxImagesPerItem = 8;
    public const long MaxInputFileSizeBytes = 8 * 1024 * 1024; // 8 MB
    public const int MinWidthPx = 400;
    public const int MinHeightPx = 400;
    public const int MaxDimensionPx = 3840; // 4K max input
    public const int MaxAltTextLength = 160;

    public const string CanonicalMimeType = "image/webp";
    public const string CanonicalExtension = ".webp";
    public const int WebpQuality = 82;

    // Dimensiones máximas para variantes responsivas de e-commerce
    public const int ThumbMaxDimension = 200;    // Listados, carritos, datagrids (~15-25 KB)
    public const int MediumMaxDimension = 800;   // Tarjetas de catálogo y grids (~60-110 KB)
    public const int LargeMaxDimension = 1600;   // Vista de detalle y zoom (~160-250 KB)

    public static readonly string[] AllowedMimeTypes =
    [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    public static readonly string[] AllowedExtensions =
    [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ];

    /// <summary>
    /// Valida que la imagen cumpla con los requisitos mínimos de calidad, peso y formato para e-commerce.
    /// </summary>
    public static Result ValidateUploadRequest(string contentType, string fileName, long fileSizeBytes, int width, int height)
    {
        var normalizedContentType = contentType.Trim().ToLowerInvariant();
        if (!AllowedMimeTypes.Contains(normalizedContentType))
        {
            return Result.Failure(new Error(
                "catalog.item.image.format.unsupported",
                $"Formato no permitido ({contentType}). Solo se admiten imágenes JPEG, PNG y WebP.",
                ErrorType.Validation));
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            return Result.Failure(new Error(
                "catalog.item.image.extension.unsupported",
                $"Extensión no permitida ({ext}). Solo se admiten archivos .jpg, .jpeg, .png y .webp.",
                ErrorType.Validation));
        }

        if (fileSizeBytes <= 0)
        {
            return Result.Failure(new Error(
                "catalog.item.image.file.empty",
                "El archivo de imagen no contiene datos.",
                ErrorType.Validation));
        }

        if (fileSizeBytes > MaxInputFileSizeBytes)
        {
            return Result.Failure(new Error(
                "catalog.item.image.size.exceeded",
                $"El peso del archivo ({Math.Round((decimal)fileSizeBytes / (1024 * 1024), 1)} MB) supera el límite máximo permitido de {MaxInputFileSizeBytes / (1024 * 1024)} MB.",
                ErrorType.Validation));
        }

        if (width < MinWidthPx || height < MinHeightPx)
        {
            return Result.Failure(new Error(
                "catalog.item.image.resolution.too_low",
                $"La resolución mínima requerida para e-commerce es de {MinWidthPx}x{MinHeightPx} px. La imagen provista tiene {width}x{height} px.",
                ErrorType.Validation));
        }

        if (width > MaxDimensionPx || height > MaxDimensionPx)
        {
            return Result.Failure(new Error(
                "catalog.item.image.resolution.too_high",
                $"La resolución máxima admitida es de {MaxDimensionPx}x{MaxDimensionPx} px. La imagen provista tiene {width}x{height} px.",
                ErrorType.Validation));
        }

        return Result.Success();
    }
}
