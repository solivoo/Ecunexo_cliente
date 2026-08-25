using EcuNexo.Business.Inventory;
using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class InventoryMovementRepository : IInventoryMovementRepository
{
    private readonly EcuNexoDbContext _db;

    public InventoryMovementRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(InventoryMovement movement, CancellationToken ct)
    {
        _db.InventoryMovements.Add(movement);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<InventoryMovement>> ListByTenantAsync(
        Guid tenantId,
        Guid? warehouseId,
        Guid? catalogItemId,
        CancellationToken ct)
    {
        var query = _db.InventoryMovements.AsNoTracking().Where(m => m.TenantId == tenantId);
        if (warehouseId.HasValue)
        {
            query = query.Where(m => m.WarehouseId == warehouseId.Value);
        }

        if (catalogItemId.HasValue)
        {
            query = query.Where(m => m.CatalogItemId == catalogItemId.Value);
        }

        return await query
            .OrderByDescending(m => m.OccurredAt)
            .ThenByDescending(m => m.CreatedAt)
            .Take(500)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct) =>
        _db.InventoryMovements.AnyAsync(
            m => m.TenantId == tenantId && m.CatalogItemId == catalogItemId,
            ct);
}
