using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PurchaseRepository : IPurchaseRepository
{
    private readonly EcuNexoDbContext _db;

    public PurchaseRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Purchase purchase, CancellationToken ct)
    {
        _db.Purchases.Add(purchase);
        return Task.CompletedTask;
    }

    public Task<Purchase?> GetByIdAsync(Guid tenantId, Guid purchaseId, CancellationToken ct) =>
        _db.Purchases.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.ExpenseType)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == purchaseId, ct);

    public Task<Purchase?> GetTrackedByIdAsync(Guid tenantId, Guid purchaseId, CancellationToken ct) =>
        _db.Purchases
            .Include(p => p.Supplier)
            .Include(p => p.ExpenseType)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == purchaseId, ct);

    public Task<Purchase?> GetByAuthorizationNumberAsync(Guid tenantId, string authorizationNumber, CancellationToken ct) =>
        _db.Purchases.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.AuthorizationNumber == authorizationNumber, ct);

    public async Task<IReadOnlyList<Purchase>> ListAsync(
        Guid tenantId,
        Guid? supplierId,
        PurchaseStatus? status,
        DateOnly? from,
        DateOnly? to,
        string? search,
        string? documentType,
        CancellationToken ct)
    {
        var query = _db.Purchases.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.ExpenseType)
            .Include(p => p.Items)
            .Where(p => p.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(documentType))
        {
            query = query.Where(p => p.DocumentType == documentType.Trim());
        }

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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().ToUpperInvariant()}%";
            query = query.Where(p =>
                EF.Functions.ILike(p.InvoiceNumber, pattern) ||
                (p.AuthorizationNumber != null && EF.Functions.ILike(p.AuthorizationNumber, pattern)) ||
                (p.Supplier != null && EF.Functions.ILike(p.Supplier.BusinessName, pattern)));
        }

        return await query
            .OrderByDescending(p => p.IssueDate)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
    }

    public Task<bool> ExistsByInvoiceNumberAsync(
        Guid tenantId,
        Guid supplierId,
        string invoiceNumber,
        Guid? excludeId,
        CancellationToken ct)
    {
        var query = _db.Purchases
            .Where(p => p.TenantId == tenantId && p.SupplierId == supplierId && p.InvoiceNumber == invoiceNumber);

        if (excludeId.HasValue)
        {
            query = query.Where(p => p.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public Task<bool> ExistsByExpenseTypeIdAsync(Guid tenantId, Guid expenseTypeId, CancellationToken ct) =>
        _db.Purchases.AsNoTracking().AnyAsync(p => p.TenantId == tenantId && p.ExpenseTypeId == expenseTypeId, ct);
}
