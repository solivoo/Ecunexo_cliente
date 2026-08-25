using EcuNexo.Business.Inventory;
using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StockRepository : IStockRepository
{
    private readonly EcuNexoDbContext _db;

    public StockRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Stock stock, CancellationToken ct)
    {
        _db.Stocks.Add(stock);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Stock>> ListByTenantAsync(Guid tenantId, Guid? warehouseId, CancellationToken ct)
    {
        var query = _db.Stocks.AsNoTracking().Where(s => s.TenantId == tenantId);
        if (warehouseId.HasValue)
        {
            query = query.Where(s => s.WarehouseId == warehouseId.Value);
        }

        return await query
            .OrderBy(s => s.CatalogItemId)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<Stock?> GetTrackedAsync(Guid tenantId, Guid catalogItemId, Guid warehouseId, CancellationToken ct) =>
        _db.Stocks.FirstOrDefaultAsync(
            s => s.TenantId == tenantId && s.CatalogItemId == catalogItemId && s.WarehouseId == warehouseId,
            ct);

    public Task<Stock?> GetTrackedByIdAsync(Guid tenantId, Guid stockId, CancellationToken ct) =>
        _db.Stocks.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == stockId, ct);

    public Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct) =>
        _db.Stocks.AnyAsync(s => s.TenantId == tenantId && s.CatalogItemId == catalogItemId, ct);
}
