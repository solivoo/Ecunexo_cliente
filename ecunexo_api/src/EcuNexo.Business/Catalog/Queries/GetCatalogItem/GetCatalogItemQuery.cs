using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Queries.GetCatalogItem;

public sealed record GetCatalogItemQuery(Guid TenantId, Guid ItemId) : IQuery<CatalogItemDetailResponse>;

public sealed record CatalogItemDetailResponse(
    Guid Id,
    CatalogItemKind Kind,
    string Name,
    string? Description,
    string? Sku,
    decimal? BasePrice,
    Guid? CategoryId,
    string? CategoryName,
    string CustomAttributesJson,
    CatalogItemStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<CatalogItemImageResponse> Images,
    bool IsMatrixParent = false,
    Guid? ParentId = null,
    string? VariantDimensionsJson = null,
    IReadOnlyList<CatalogItemVariantDto>? Variants = null,
    string? ParentName = null,
    Guid? FamilyId = null,
    string? FamilyName = null,
    string? HierarchyPathJson = null);

public sealed record CatalogItemVariantDto(
    Guid Id,
    string Name,
    string? Sku,
    decimal? BasePrice,
    string CustomAttributesJson,
    CatalogItemStatus Status,
    string? MainImageThumbUrl = null);
