using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog;

public sealed record CatalogItemImageResponse(
    Guid Id,
    Guid CatalogItemId,
    string OriginalFileName,
    string? AltText,
    int DisplayOrder,
    bool IsMain,
    int OriginalWidth,
    int OriginalHeight,
    long FileSizeBytes,
    string MimeType,
    string ThumbUrl,
    string MediumUrl,
    string LargeUrl,
    DateTimeOffset CreatedAt)
{
    public static CatalogItemImageResponse FromEntity(CatalogItemImage entity) =>
        new(
            entity.Id,
            entity.CatalogItemId,
            entity.OriginalFileName,
            entity.AltText,
            entity.DisplayOrder,
            entity.IsMain,
            entity.OriginalWidth,
            entity.OriginalHeight,
            entity.FileSizeBytes,
            entity.MimeType,
            entity.ThumbUrl,
            entity.MediumUrl,
            entity.LargeUrl,
            entity.CreatedAt);
}
