using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Customers;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CustomerRepairRateCardRepository : ICustomerRepairRateCardRepository
{
    private readonly EcuNexoDbContext _db;

    public CustomerRepairRateCardRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(CustomerRepairRateCard card, CancellationToken ct)
    {
        _db.CustomerRepairRateCards.Add(card);
        return Task.CompletedTask;
    }

    public Task<CustomerRepairRateCard?> GetByCustomerAsync(Guid tenantId, Guid customerId, CancellationToken ct) =>
        _db.CustomerRepairRateCards.AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CustomerId == customerId, ct);

    public Task<CustomerRepairRateCard?> GetTrackedByCustomerAsync(Guid tenantId, Guid customerId, CancellationToken ct) =>
        _db.CustomerRepairRateCards
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CustomerId == customerId, ct);
}
