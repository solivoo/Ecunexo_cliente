using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory;

public interface IInventoryMovementRepository
{
    Task AddAsync(InventoryMovement movement, CancellationToken ct);

    Task<IReadOnlyList<InventoryMovement>> ListByTenantAsync(
        Guid tenantId,
        Guid? warehouseId,
        Guid? catalogItemId,
        CancellationToken ct);

    Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct);
}
