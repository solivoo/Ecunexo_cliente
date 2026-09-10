using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Customers;
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

    public Task<IReadOnlyList<Customer>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        ListAsync(tenantId, null, null, null, null, ct);

    public async Task<IReadOnlyList<Customer>> ListAsync(
        Guid tenantId,
        CustomerType? type,
        string? search,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct)
    {
        var query = _db.Customers.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (type.HasValue)
        {
            query = query.Where(c => c.CustomerType == type.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, pattern) ||
                (c.TaxId != null && EF.Functions.ILike(c.TaxId, pattern)) ||
                (c.ContactPerson != null && EF.Functions.ILike(c.ContactPerson, pattern)) ||
                (c.ContactEmail != null && EF.Functions.ILike(c.ContactEmail, pattern)));
        }

        if (from.HasValue)
        {
            query = query.Where(c => c.CreatedAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(c => c.CreatedAt <= to.Value);
        }

        return await query
            .OrderByDescending(c => c.CreatedAt)
            .ThenBy(c => c.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct) =>
        _db.Customers.AsNoTracking()
            .AnyAsync(c => c.TenantId == tenantId && EF.Functions.ILike(c.Name, name) && c.DeletedAt == null && (!excludeId.HasValue || c.Id != excludeId.Value), ct);

    public Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct) =>
        _db.Customers.AsNoTracking()
            .AnyAsync(c => c.TenantId == tenantId && c.TaxId == taxId && c.DeletedAt == null && (!excludeId.HasValue || c.Id != excludeId.Value), ct);
}
