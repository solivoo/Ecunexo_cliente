using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Repositories;

public interface IRepairBatchRepository
{
    Task AddAsync(RepairBatch batch, CancellationToken ct);
    Task<RepairBatch?> GetByIdAsync(Guid tenantId, Guid batchId, CancellationToken ct);
    Task<RepairBatch?> GetTrackedWithEquipmentsAsync(Guid tenantId, Guid batchId, CancellationToken ct);
    Task<IReadOnlyList<RepairBatch>> ListByTenantAsync(Guid tenantId, Guid? customerId, RepairBatchStatus? status, CancellationToken ct);
    Task<bool> ExistsByBatchNumberAsync(Guid tenantId, string batchNumber, CancellationToken ct);
}
