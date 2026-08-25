using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Catalog.Queries.ListCatalogItems;

public sealed record ListCatalogItemsQuery(Guid TenantId, CatalogItemKind? Kind = null)
    : IQuery<IReadOnlyList<CatalogItemListItemResponse>>;

public sealed record CatalogItemListItemResponse(
    Guid Id,
    CatalogItemKind Kind,
    string Name,
    string? Description,
    string? Sku,
    decimal? BasePrice,
    Guid? CategoryId,
    string? CategoryName,
    CatalogItemStatus Status,
    DateTimeOffset CreatedAt);
