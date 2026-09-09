using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly EcuNexoDbContext _db;

    public UserRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(User user, CancellationToken ct)
    {
        _db.Users.Add(user);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<User>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null)
            .OrderBy(u => u.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<bool> EmailExistsAsync(
        Guid tenantId,
        Email email,
        CancellationToken ct,
        Guid? excludeUserId = null)
    {
        var query = _db.Users.AsNoTracking()
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && u.Email == email);
        if (excludeUserId is Guid id)
        {
            query = query.Where(u => u.Id != id);
        }

        return query.AnyAsync(ct);
    }

    public Task<User?> GetActiveByIdAsync(Guid tenantId, Guid userId, CancellationToken ct) =>
        _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.TenantId == tenantId && u.Id == userId && u.DeletedAt == null,
                ct);

    public Task<User?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid userId, CancellationToken ct) =>
        _db.Users.FirstOrDefaultAsync(
            u => u.TenantId == tenantId && u.Id == userId && u.DeletedAt == null,
            ct);

    public Task<User?> GetActiveByEmailForUpdateAsync(Guid tenantId, Email email, CancellationToken ct) =>
        _db.Users.FirstOrDefaultAsync(
            u => u.TenantId == tenantId && u.DeletedAt == null && u.Email == email,
            ct);

    public async Task<User?> GetActiveByEmailForLoginAsync(Email email, CancellationToken ct)
    {
        var matches = await _db.Users
            .Where(u => u.DeletedAt == null && u.Email == email)
            .Take(2)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return matches.Count == 1 ? matches[0] : null;
    }

    public async Task<IReadOnlyList<User>> ListActiveByDepartmentIdForUpdateAsync(
        Guid tenantId,
        Guid departmentId,
        CancellationToken ct) =>
        await _db.Users
            .Where(u =>
                u.TenantId == tenantId
                && u.DepartmentId == departmentId
                && u.DeletedAt == null)
            .ToListAsync(ct)
            .ConfigureAwait(false);
}
