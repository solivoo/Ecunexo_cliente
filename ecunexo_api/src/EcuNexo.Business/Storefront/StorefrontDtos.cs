using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

public sealed record StorefrontProductPageDto(
    IReadOnlyList<StorefrontProductListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record StorefrontProductListItemDto(
    Guid Id,
    CatalogItemKind Kind,
    string Name,
    string? Description,
    decimal? Price,
    string? ThumbUrl,
    string? MediumUrl,
    bool InStock,
    bool HasVariants,
    int VariantCount,
    DateTimeOffset CreatedAt);

public sealed record StorefrontProductDetailDto(
    Guid Id,
    CatalogItemKind Kind,
    string Name,
    string? Sku,
    string? Description,
    decimal? Price,
    bool InStock,
    decimal AvailableQuantity,
    IReadOnlyList<StorefrontImageDto> Images,
    IReadOnlyList<StorefrontVariantDto> Variants,
    StorefrontMatrixDto? Matrix,
    IReadOnlyList<StorefrontAttributeDto> Attributes,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

public sealed record StorefrontImageDto(
    Guid Id,
    string? AltText,
    bool IsMain,
    string ThumbUrl,
    string MediumUrl,
    string LargeUrl);

public sealed record StorefrontVariantDto(
    Guid Id,
    string Name,
    string? Sku,
    decimal? Price,
    bool InStock,
    decimal AvailableQuantity,
    IReadOnlyDictionary<string, string>? Dimensions,
    string? MainImageThumbUrl,
    string? MainImageMediumUrl,
    bool ImageInherited,
    string? ImageInheritedFrom,
    IReadOnlyList<StorefrontImageDto>? Images,
    IReadOnlyList<string>? ExtraColors);

public sealed record StorefrontMatrixDto(
    int Depth,
    string? PrimaryAxis,
    IReadOnlyList<StorefrontMatrixAxisDto> Axes,
    IReadOnlyList<string> GroupValues);

public sealed record StorefrontMatrixAxisDto(
    string Name,
    string Type,
    IReadOnlyList<string> Values,
    bool IsPhotoGroup);

public sealed record StorefrontAttributeDto(
    string Level,
    string Name,
    string Value);
