using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Entidad que representa una imagen optimizada asociada a un ítem de catálogo para e-commerce.
/// </summary>
public sealed class CatalogItemImage : Entity<Guid>, IAuditable
{
    private CatalogItemImage()
    {
        StorageKey = string.Empty;
        OriginalFileName = string.Empty;
        MimeType = ImageOptimizationPolicy.CanonicalMimeType;
        ThumbUrl = string.Empty;
        MediumUrl = string.Empty;
        LargeUrl = string.Empty;
    }

    public Guid CatalogItemId { get; private set; }
    public CatalogItem? CatalogItem { get; private set; }

    public string StorageKey { get; private set; }
    public string OriginalFileName { get; private set; }
    public string? AltText { get; private set; }
    public int DisplayOrder { get; internal set; }
    public bool IsMain { get; internal set; }

    public int OriginalWidth { get; private set; }
    public int OriginalHeight { get; private set; }
    public long FileSizeBytes { get; private set; }
    public string MimeType { get; private set; }

    // URLs públicas de las 3 variantes e-commerce
    public string ThumbUrl { get; private set; }
    public string MediumUrl { get; private set; }
    public string LargeUrl { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public static Result<CatalogItemImage> Create(
        Guid id,
        Guid catalogItemId,
        string storageKey,
        string originalFileName,
        string? altText,
        int displayOrder,
        bool isMain,
        ImageDimensions dimensions,
        long fileSizeBytes,
        string thumbUrl,
        string mediumUrl,
        string largeUrl,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<CatalogItemImage>(
                new Error("catalog.item.image.id.empty", "El identificador de la imagen es obligatorio.", ErrorType.Validation));
        }

        if (catalogItemId == Guid.Empty)
        {
            return Result.Failure<CatalogItemImage>(
                new Error("catalog.item.image.item_id.empty", "El ítem asociado es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(storageKey))
        {
            return Result.Failure<CatalogItemImage>(
                new Error("catalog.item.image.storage_key.empty", "La clave de almacenamiento es obligatoria.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(originalFileName))
        {
            return Result.Failure<CatalogItemImage>(
                new Error("catalog.item.image.file_name.empty", "El nombre original del archivo es obligatorio.", ErrorType.Validation));
        }

        var normalizedAlt = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim();
        if (normalizedAlt is not null && normalizedAlt.Length > ImageOptimizationPolicy.MaxAltTextLength)
        {
            return Result.Failure<CatalogItemImage>(
                new Error("catalog.item.image.alt_text.too_long",
                    $"El texto alternativo no puede superar los {ImageOptimizationPolicy.MaxAltTextLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(new CatalogItemImage
        {
            Id = id,
            CatalogItemId = catalogItemId,
            StorageKey = storageKey.Trim(),
            OriginalFileName = Path.GetFileName(originalFileName).Trim(),
            AltText = normalizedAlt,
            DisplayOrder = displayOrder,
            IsMain = isMain,
            OriginalWidth = dimensions.Width,
            OriginalHeight = dimensions.Height,
            FileSizeBytes = fileSizeBytes,
            MimeType = ImageOptimizationPolicy.CanonicalMimeType,
            ThumbUrl = thumbUrl.Trim(),
            MediumUrl = mediumUrl.Trim(),
            LargeUrl = largeUrl.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        });
    }

    internal void PromoteToMain()
    {
        IsMain = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    internal void DemoteFromMain()
    {
        IsMain = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    internal void SetOrder(int newOrder)
    {
        DisplayOrder = newOrder;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public Result UpdateAltText(string? altText, Guid? updatedBy = null)
    {
        var normalizedAlt = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim();
        if (normalizedAlt is not null && normalizedAlt.Length > ImageOptimizationPolicy.MaxAltTextLength)
        {
            return Result.Failure(
                new Error("catalog.item.image.alt_text.too_long",
                    $"El texto alternativo no puede superar los {ImageOptimizationPolicy.MaxAltTextLength} caracteres.",
                    ErrorType.Validation));
        }

        AltText = normalizedAlt;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public void UpdateUrls(string thumbUrl, string mediumUrl, string largeUrl, Guid? updatedBy = null)
    {
        ThumbUrl = thumbUrl.Trim();
        MediumUrl = mediumUrl.Trim();
        LargeUrl = largeUrl.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
