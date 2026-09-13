using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class SupplierRepository : ISupplierRepository
{
    private readonly EcuNexoDbContext _db;

    public SupplierRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Supplier supplier, CancellationToken ct)
    {
        _db.Suppliers.Add(supplier);
        return Task.CompletedTask;
    }

    public Task<Supplier?> GetByIdAsync(Guid tenantId, Guid supplierId, CancellationToken ct) =>
        _db.Suppliers.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == supplierId && s.DeletedAt == null, ct);

    public Task<Supplier?> GetTrackedByIdAsync(Guid tenantId, Guid supplierId, CancellationToken ct) =>
        _db.Suppliers
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == supplierId && s.DeletedAt == null, ct);

    public Task<Supplier?> GetByTaxIdAsync(Guid tenantId, string taxId, CancellationToken ct) =>
        _db.Suppliers.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.TaxId == taxId && s.DeletedAt == null, ct);

    public async Task<IReadOnlyList<Supplier>> ListAsync(Guid tenantId, string? search, bool? activeOnly, CancellationToken ct)
    {
        var query = _db.Suppliers.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null);

        if (activeOnly.HasValue)
        {
            query = query.Where(s => s.IsActive == activeOnly.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(s =>
                EF.Functions.ILike(s.BusinessName, pattern) ||
                EF.Functions.ILike(s.TaxId, pattern) ||
                (s.TradeName != null && EF.Functions.ILike(s.TradeName, pattern)) ||
                (s.ContactEmail != null && EF.Functions.ILike(s.ContactEmail, pattern)));
        }

        return await query
            .OrderBy(s => s.BusinessName)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct)
    {
        var normalized = taxId.Trim();
        var query = _db.Suppliers.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.TaxId == normalized && s.DeletedAt == null);

        if (excludeId.HasValue)
        {
            query = query.Where(s => s.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public Task<bool> ExistsByBusinessNameAsync(Guid tenantId, string businessName, Guid? excludeId, CancellationToken ct)
    {
        var normalized = businessName.Trim();
        var query = _db.Suppliers.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && EF.Functions.ILike(s.BusinessName, normalized));

        if (excludeId.HasValue)
        {
            query = query.Where(s => s.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }
}
