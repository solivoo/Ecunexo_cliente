using EcuNexo.Business.Storefront;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StorefrontCatalogRepository : IStorefrontCatalogRepository
{
    private readonly EcuNexoDbContext _db;

    public StorefrontCatalogRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CatalogItem>> ListActiveRootsAsync(
        Guid tenantId,
        CancellationToken ct)
    {
        return await _db.CatalogItems.AsNoTracking()
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
            .Where(i => i.TenantId == tenantId
                && i.DeletedAt == null
                && i.Status == CatalogItemStatus.Active
                && i.Kind == CatalogItemKind.Physical
                && i.ParentId == null
                && !i.IsHiddenFromStorefront)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<CatalogItem?> FindActiveRootAsync(
        Guid tenantId,
        Guid catalogItemId,
        CancellationToken ct) =>
        _db.CatalogItems.AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.TenantId == tenantId
                    && i.Id == catalogItemId
                    && i.DeletedAt == null
                    && i.Status == CatalogItemStatus.Active
                    && i.Kind == CatalogItemKind.Physical
                    && i.ParentId == null
                    && !i.IsHiddenFromStorefront,
                ct);

    public async Task<DateTimeOffset?> GetLastCatalogChangeAtAsync(Guid tenantId, CancellationToken ct)
    {
        // Sin filtro de borrado/estado: altas, cambios y bajas del catálogo deben detectarse.
        var itemAt = await _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId)
            .MaxAsync(i => (DateTimeOffset?)(i.UpdatedAt ?? i.CreatedAt), ct)
            .ConfigureAwait(false);

        var templateAt = await _db.ProductTemplates.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .MaxAsync(t => (DateTimeOffset?)(t.UpdatedAt ?? t.CreatedAt), ct)
            .ConfigureAwait(false);

        var listAt = await _db.PriceLists.AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .MaxAsync(l => (DateTimeOffset?)(l.UpdatedAt ?? l.CreatedAt), ct)
            .ConfigureAwait(false);

        var priceAt = await _db.ProductPrices.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .MaxAsync(p => (DateTimeOffset?)(p.UpdatedAt ?? p.CreatedAt), ct)
            .ConfigureAwait(false);

        var promoAt = await _db.Promotions.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .MaxAsync(p => (DateTimeOffset?)(p.UpdatedAt ?? p.CreatedAt), ct)
            .ConfigureAwait(false);

        return new[] { itemAt, templateAt, listAt, priceAt, promoAt }.Max();
    }
}
