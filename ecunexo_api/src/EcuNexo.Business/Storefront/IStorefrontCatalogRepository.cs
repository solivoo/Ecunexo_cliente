using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

public sealed record StorefrontProductFilter(
    string? Search,
    string? Sort,
    int Page,
    int PageSize,
    Guid? DefaultPriceListId = null,
    DateOnly? Date = null);

public interface IStorefrontCatalogRepository
{
    Task<(IReadOnlyList<CatalogItem> Items, int TotalCount)> ListActiveRootsAsync(
        Guid tenantId,
        StorefrontProductFilter filter,
        CancellationToken ct);
}
