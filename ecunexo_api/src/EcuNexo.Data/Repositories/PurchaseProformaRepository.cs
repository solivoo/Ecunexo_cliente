using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PurchaseProformaRepository : IPurchaseProformaRepository
{
    private readonly EcuNexoDbContext _db;

    public PurchaseProformaRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(PurchaseProforma proforma, CancellationToken ct)
    {
        _db.PurchaseProformas.Add(proforma);
        return Task.CompletedTask;
    }

    public Task<PurchaseProforma?> GetByIdAsync(Guid tenantId, Guid proformaId, CancellationToken ct) =>
        _db.PurchaseProformas.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == proformaId, ct);

    public Task<PurchaseProforma?> GetTrackedByIdAsync(Guid tenantId, Guid proformaId, CancellationToken ct) =>
        _db.PurchaseProformas
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == proformaId, ct);

    public async Task<IReadOnlyList<PurchaseProforma>> ListAsync(
        Guid tenantId,
        Guid? supplierId,
        PurchaseProformaStatus? status,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct)
    {
        var query = _db.PurchaseProformas.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .Where(p => p.TenantId == tenantId);

        if (supplierId.HasValue)
        {
            query = query.Where(p => p.SupplierId == supplierId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(p => p.IssueDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(p => p.IssueDate <= to.Value);
        }

        return await query
            .OrderByDescending(p => p.IssueDate)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByNumberAsync(Guid tenantId, Guid supplierId, string proformaNumber, Guid? excludeId, CancellationToken ct)
    {
        var normalized = proformaNumber.Trim();
        var query = _db.PurchaseProformas.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.SupplierId == supplierId && p.ProformaNumber == normalized);

        if (excludeId.HasValue)
        {
            query = query.Where(p => p.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }
}
