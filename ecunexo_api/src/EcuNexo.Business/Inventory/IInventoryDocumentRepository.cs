using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory;

public interface IInventoryDocumentRepository
{
    Task AddAsync(InventoryDocument document, CancellationToken ct);

    Task<IReadOnlyList<InventoryDocument>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<InventoryDocument?> GetByIdAsync(Guid tenantId, Guid documentId, CancellationToken ct);

    Task<InventoryDocument?> GetTrackedWithLinesAsync(Guid tenantId, Guid documentId, CancellationToken ct);

    Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct);
}
