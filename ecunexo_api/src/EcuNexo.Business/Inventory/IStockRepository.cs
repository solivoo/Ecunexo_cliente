using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory;

public interface IStockRepository
{
    Task AddAsync(Stock stock, CancellationToken ct);

    Task<IReadOnlyList<Stock>> ListByTenantAsync(Guid tenantId, Guid? warehouseId, CancellationToken ct);

    Task<Stock?> GetTrackedAsync(Guid tenantId, Guid catalogItemId, Guid warehouseId, CancellationToken ct);

    Task<Stock?> GetTrackedByIdAsync(Guid tenantId, Guid stockId, CancellationToken ct);

    Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct);
}
