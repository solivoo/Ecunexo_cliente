using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Purchases;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ExpenseTypeRepository : IExpenseTypeRepository
{
    private readonly EcuNexoDbContext _db;

    public ExpenseTypeRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ExpenseType expenseType, CancellationToken ct)
    {
        _db.ExpenseTypes.Add(expenseType);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<ExpenseType> expenseTypes, CancellationToken ct)
    {
        _db.ExpenseTypes.AddRange(expenseTypes);
        return Task.CompletedTask;
    }

    public Task<ExpenseType?> GetByIdAsync(Guid tenantId, Guid expenseTypeId, CancellationToken ct) =>
        _db.ExpenseTypes.AsNoTracking()
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.Id == expenseTypeId, ct);

    public Task<ExpenseType?> GetTrackedByIdAsync(Guid tenantId, Guid expenseTypeId, CancellationToken ct) =>
        _db.ExpenseTypes
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.Id == expenseTypeId, ct);

    public async Task<IReadOnlyList<ExpenseType>> ListAsync(Guid tenantId, bool? activeOnly, CancellationToken ct)
    {
        var query = _db.ExpenseTypes.AsNoTracking()
            .Where(e => e.TenantId == tenantId);

        if (activeOnly.HasValue)
        {
            query = query.Where(e => e.IsActive == activeOnly.Value);
        }

        return await query
            .OrderBy(e => e.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var query = _db.ExpenseTypes.AsNoTracking()
            .Where(e => e.TenantId == tenantId && e.Code == normalized);

        if (excludeId.HasValue)
        {
            query = query.Where(e => e.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public Task<int> CountAsync(Guid tenantId, CancellationToken ct) =>
        _db.ExpenseTypes.AsNoTracking().CountAsync(e => e.TenantId == tenantId, ct);
}
