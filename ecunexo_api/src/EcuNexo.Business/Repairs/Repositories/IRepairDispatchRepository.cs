using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Repositories;

public interface IRepairDispatchRepository
{
    Task AddAsync(RepairDispatch dispatch, CancellationToken ct);
    Task<RepairDispatch?> GetByIdAsync(Guid tenantId, Guid dispatchId, CancellationToken ct);
    Task<RepairDispatch?> GetTrackedWithItemsAsync(Guid tenantId, Guid dispatchId, CancellationToken ct);
    Task<RepairDispatch?> GetByVerificationHashAsync(string verificationHash, CancellationToken ct);
    Task<IReadOnlyList<RepairDispatch>> ListByBatchAsync(Guid tenantId, Guid batchId, CancellationToken ct);
    Task<IReadOnlyList<RepairDispatch>> ListByTenantAsync(Guid tenantId, CancellationToken ct);
}
