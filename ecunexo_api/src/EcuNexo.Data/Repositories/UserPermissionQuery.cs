using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class UserPermissionQuery : IUserPermissionQuery
{
    private readonly EcuNexoDbContext _db;

    public UserPermissionQuery(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task<bool> UserHasPermissionAsync(Guid tenantId, Guid userId, Guid permissionId, CancellationToken ct) =>
        (from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            join rp in _db.RolePermissions.AsNoTracking() on r.Id equals rp.RoleId
            where ur.TenantId == tenantId
                  && ur.UserId == userId
                  && r.TenantId == tenantId
                  && r.DeletedAt == null
                  && rp.PermissionId == permissionId
            select rp).AnyAsync(ct);

    public async Task<IReadOnlyList<string>> ListEffectivePermissionCodesAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct) =>
        await (from ur in _db.UserRoles.AsNoTracking()
                join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
                join rp in _db.RolePermissions.AsNoTracking() on r.Id equals rp.RoleId
                join p in _db.Permissions.AsNoTracking() on rp.PermissionId equals p.Id
                where ur.TenantId == tenantId
                      && ur.UserId == userId
                      && r.TenantId == tenantId
                      && r.DeletedAt == null
                      && p.DeletedAt == null
                      && p.Status == PermissionStatus.Active
                select p.Code)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct)
            .ConfigureAwait(false);
}
