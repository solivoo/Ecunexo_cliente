using EcuNexo.Core.Customers;

namespace EcuNexo.Business.Customers.Repositories;

public interface ICustomerTypeDefinitionRepository
{
    Task<IReadOnlyList<CustomerTypeDefinition>> ListAsync(Guid tenantId, bool activeOnly, CancellationToken ct);

    Task<CustomerTypeDefinition?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct);

    Task<CustomerTypeDefinition?> GetTrackedByIdAsync(Guid tenantId, Guid id, CancellationToken ct);

    Task<CustomerTypeDefinition?> GetByCodeAsync(Guid tenantId, int code, CancellationToken ct);

    Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);

    Task<int> GetNextCustomCodeAsync(Guid tenantId, CancellationToken ct);

    Task EnsureSystemDefaultsAsync(Guid tenantId, CancellationToken ct);

    Task AddAsync(CustomerTypeDefinition entity, CancellationToken ct);
}
