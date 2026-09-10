using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Repositories;

public interface IRepairBatchTemplateRepository
{
    Task AddAsync(RepairBatchTemplate template, CancellationToken ct);
    Task<RepairBatchTemplate?> GetByIdAsync(Guid tenantId, Guid templateId, CancellationToken ct);
    Task<IReadOnlyList<RepairBatchTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct);
    Task<RepairBatchTemplate?> GetDefaultOrActiveForCustomerAsync(Guid tenantId, Guid? customerId, CancellationToken ct);
}
