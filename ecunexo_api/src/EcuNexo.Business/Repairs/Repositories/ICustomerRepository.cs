using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Repositories;

public interface ICustomerRepository
{
    Task AddAsync(Customer customer, CancellationToken ct);
    Task<Customer?> GetByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct);
    Task<Customer?> GetTrackedByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct);
    Task<IReadOnlyList<Customer>> ListByTenantAsync(Guid tenantId, CancellationToken ct);
    Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);
    Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct);
}
