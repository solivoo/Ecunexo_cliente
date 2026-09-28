using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

public interface IStorefrontCatalogRepository
{
    Task<IReadOnlyList<CatalogItem>> ListActiveRootsAsync(
        Guid tenantId,
        CancellationToken ct);

    /// <summary>Producto raíz activo de la tienda; <c>null</c> si no existe, es variante o no es del tenant.</summary>
    Task<CatalogItem?> FindActiveRootAsync(
        Guid tenantId,
        Guid catalogItemId,
        CancellationToken ct);

    /// <summary>Momento de la última modificación relevante del catálogo (ítems, plantillas, precios y promociones).</summary>
    Task<DateTimeOffset?> GetLastCatalogChangeAtAsync(Guid tenantId, CancellationToken ct);
}
