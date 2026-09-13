using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Accounting;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class AccountRepository : IAccountRepository
{
    private readonly EcuNexoDbContext _db;

    public AccountRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Account account, CancellationToken ct)
    {
        _db.Accounts.Add(account);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<Account> accounts, CancellationToken ct)
    {
        _db.Accounts.AddRange(accounts);
        return Task.CompletedTask;
    }

    public Task<Account?> GetByIdAsync(Guid tenantId, Guid accountId, CancellationToken ct) =>
        _db.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Id == accountId, ct);

    public Task<Account?> GetTrackedByIdAsync(Guid tenantId, Guid accountId, CancellationToken ct) =>
        _db.Accounts
            .FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Id == accountId, ct);

    public Task<Account?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct)
    {
        var normalized = code.Trim().Replace(" ", string.Empty);
        return _db.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Code == normalized, ct);
    }

    public async Task<IReadOnlyList<Account>> ListAsync(
        Guid tenantId,
        AccountType? type,
        bool? allowsMovementOnly,
        bool? activeOnly,
        string? search,
        CancellationToken ct)
    {
        var query = _db.Accounts.AsNoTracking()
            .Where(a => a.TenantId == tenantId);

        if (type.HasValue)
        {
            query = query.Where(a => a.AccountType == type.Value);
        }

        if (allowsMovementOnly.HasValue)
        {
            query = query.Where(a => a.AllowsMovement == allowsMovementOnly.Value);
        }

        if (activeOnly.HasValue)
        {
            query = query.Where(a => a.IsActive == activeOnly.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(a =>
                EF.Functions.ILike(a.Code, pattern) ||
                EF.Functions.ILike(a.Name, pattern) ||
                (a.Description != null && EF.Functions.ILike(a.Description, pattern)));
        }

        return await query
            .OrderBy(a => a.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct)
    {
        var normalized = code.Trim().Replace(" ", string.Empty);
        var query = _db.Accounts.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.Code == normalized);

        if (excludeId.HasValue)
        {
            query = query.Where(a => a.Id != excludeId.Value);
        }

        return query.AnyAsync(ct);
    }

    public Task<int> CountAsync(Guid tenantId, CancellationToken ct) =>
        _db.Accounts.AsNoTracking().CountAsync(a => a.TenantId == tenantId, ct);
}
