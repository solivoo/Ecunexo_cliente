using EcuNexo.Core.Customers;

namespace EcuNexo.Business.Customers.Repositories;

public interface ICustomerRepairRateCardRepository
{
    Task AddAsync(CustomerRepairRateCard card, CancellationToken ct);

    Task<CustomerRepairRateCard?> GetByCustomerAsync(Guid tenantId, Guid customerId, CancellationToken ct);

    Task<CustomerRepairRateCard?> GetTrackedByCustomerAsync(Guid tenantId, Guid customerId, CancellationToken ct);
}
