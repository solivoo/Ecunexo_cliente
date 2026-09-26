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
                && i.ParentId == null)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }
}
