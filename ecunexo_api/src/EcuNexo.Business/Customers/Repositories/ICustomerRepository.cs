using EcuNexo.Core.Customers;

namespace EcuNexo.Business.Customers.Repositories;

public interface ICustomerRepository
{
    Task AddAsync(Customer customer, CancellationToken ct);
    Task<Customer?> GetByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct);
    Task<Customer?> GetTrackedByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct);
    Task<IReadOnlyList<Customer>> ListByTenantAsync(Guid tenantId, CancellationToken ct);
    Task<IReadOnlyList<Customer>> ListAsync(
        Guid tenantId,
        CustomerType? type,
        string? search,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct);
    Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);
    Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct);
}
