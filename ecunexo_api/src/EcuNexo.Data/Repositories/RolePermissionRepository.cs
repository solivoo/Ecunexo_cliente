using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RolePermissionRepository : IRolePermissionRepository
{
    private readonly EcuNexoDbContext _db;

    public RolePermissionRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(RolePermission link, CancellationToken ct)
    {
        var tracked = _db.RolePermissions.Local.FirstOrDefault(
            rp => rp.RoleId == link.RoleId && rp.PermissionId == link.PermissionId);
        if (tracked is not null)
        {
            var entry = _db.Entry(tracked);
            if (entry.State == EntityState.Deleted)
            {
                entry.State = EntityState.Unchanged;
            }

            return Task.CompletedTask;
        }

        _db.RolePermissions.Add(link);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Guid>> ListPermissionIdsByRoleAsync(
        Guid tenantId,
        Guid roleId,
        CancellationToken ct) =>
        await _db.RolePermissions.AsNoTracking()
            .IgnoreQueryFilters()
            .Where(rp => rp.RoleId == roleId && rp.Role.TenantId == tenantId && rp.Role.DeletedAt == null)
            .Select(rp => rp.PermissionId)
            .Distinct()
            .OrderBy(id => id)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<bool> LinkExistsAsync(Guid roleId, Guid permissionId, CancellationToken ct) =>
        _db.RolePermissions.AsNoTracking().AnyAsync(
            rp => rp.RoleId == roleId && rp.PermissionId == permissionId,
            ct);

    public async Task<bool> RemoveAsync(Guid tenantId, Guid roleId, Guid permissionId, CancellationToken ct)
    {
        var tracked = _db.RolePermissions.Local.FirstOrDefault(
            rp => rp.RoleId == roleId && rp.PermissionId == permissionId);
        if (tracked is not null)
        {
            var entry = _db.Entry(tracked);
            if (entry.State == EntityState.Added)
            {
                entry.State = EntityState.Detached;
                return true;
            }

            if (entry.State == EntityState.Deleted)
            {
                return false;
            }

            _db.RolePermissions.Remove(tracked);
            return true;
        }

        var link = await _db.RolePermissions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                rp => rp.RoleId == roleId
                    && rp.PermissionId == permissionId
                    && rp.Role.TenantId == tenantId
                    && rp.Role.DeletedAt == null,
                ct)
            .ConfigureAwait(false);
        if (link is null)
        {
            return false;
        }

        _db.RolePermissions.Remove(link);
        return true;
    }
}
