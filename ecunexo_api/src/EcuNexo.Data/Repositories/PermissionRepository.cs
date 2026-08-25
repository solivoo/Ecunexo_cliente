using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PermissionRepository : IPermissionRepository
{
    private readonly EcuNexoDbContext _db;

    public PermissionRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Permission permission, CancellationToken ct)
    {
        _db.Permissions.Add(permission);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Permission>> ListNonDeletedOrderedByCodeAsync(CancellationToken ct) =>
        await _db.Permissions.AsNoTracking()
            .Where(p => p.DeletedAt == null)
            .OrderBy(p => p.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<Permission?> GetByIdAsync(Guid permissionId, CancellationToken ct) =>
        _db.Permissions.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == permissionId && p.DeletedAt == null, ct);

    public Task<bool> CodeExistsAsync(string normalizedCode, CancellationToken ct) =>
        _db.Permissions.AsNoTracking().AnyAsync(
            p => p.Code == normalizedCode && p.DeletedAt == null,
            ct);

    public Task<bool> ExistsActiveByIdAsync(Guid permissionId, CancellationToken ct) =>
        _db.Permissions.AsNoTracking().AnyAsync(
            p => p.Id == permissionId
                && p.Status == PermissionStatus.Active
                && p.DeletedAt == null,
            ct);

    public Task<Guid?> GetActiveIdByCodeAsync(string normalizedCode, CancellationToken ct) =>
        _db.Permissions.AsNoTracking()
            .Where(
                p => p.Code == normalizedCode
                    && p.Status == PermissionStatus.Active
                    && p.DeletedAt == null)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(ct);
}
