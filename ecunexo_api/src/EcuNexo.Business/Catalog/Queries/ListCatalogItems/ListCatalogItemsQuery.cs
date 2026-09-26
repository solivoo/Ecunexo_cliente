using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Queries.ListCatalogItems;

public sealed record ListCatalogItemsQuery(
    Guid TenantId,
    CatalogItemKind? Kind = null,
    CatalogItemStatus? Status = null,
    bool OnlyRoots = false)
    : IQuery<IReadOnlyList<CatalogItemListItemResponse>>;

public sealed record CatalogItemListItemResponse(
    Guid Id,
    CatalogItemKind Kind,
    string Name,
    string? Description,
    string? Sku,
    decimal? BasePrice,
    CatalogItemStatus Status,
    DateTimeOffset CreatedAt,
    string? MainImageThumbUrl = null,
    string? MainImageUrl = null,
    bool IsMatrixParent = false,
    Guid? ParentId = null,
    int VariantCount = 0,
    string? VariantDimensionsJson = null,
    Guid? FamilyId = null,
    string? FamilyName = null,
    string? HierarchyPathJson = null,
    string? CustomAttributesJson = null);
