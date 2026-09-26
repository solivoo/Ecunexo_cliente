using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

public interface IStorefrontCatalogRepository
{
    Task<IReadOnlyList<CatalogItem>> ListActiveRootsAsync(
        Guid tenantId,
        CancellationToken ct);
}
