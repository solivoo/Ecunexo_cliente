using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CustomerRepository : ICustomerRepository
{
    private readonly EcuNexoDbContext _db;

    public CustomerRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Customer customer, CancellationToken ct)
    {
        _db.Customers.Add(customer);
        return Task.CompletedTask;
    }

    public Task<Customer?> GetByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct) =>
        _db.Customers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == customerId && c.DeletedAt == null, ct);

    public Task<Customer?> GetTrackedByIdAsync(Guid tenantId, Guid customerId, CancellationToken ct) =>
        _db.Customers
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == customerId && c.DeletedAt == null, ct);

    public async Task<IReadOnlyList<Customer>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Customers.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct) =>
        _db.Customers.AsNoTracking()
            .AnyAsync(c => c.TenantId == tenantId && EF.Functions.ILike(c.Name, name) && c.DeletedAt == null && (!excludeId.HasValue || c.Id != excludeId.Value), ct);

    public Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct) =>
        _db.Customers.AsNoTracking()
            .AnyAsync(c => c.TenantId == tenantId && c.TaxId == taxId && c.DeletedAt == null && (!excludeId.HasValue || c.Id != excludeId.Value), ct);
}
