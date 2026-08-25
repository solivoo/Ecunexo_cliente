using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class UserRoleRepository : IUserRoleRepository
{
    private readonly EcuNexoDbContext _db;

    public UserRoleRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(UserRole assignment, CancellationToken ct)
    {
        _db.UserRoles.Add(assignment);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Guid>> ListRoleIdsForUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct) =>
        await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.TenantId == tenantId && ur.UserId == userId)
            .Select(ur => ur.RoleId)
            .Distinct()
            .OrderBy(id => id)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<bool> AssignmentExistsAsync(Guid tenantId, Guid userId, Guid roleId, CancellationToken ct) =>
        _db.UserRoles.AsNoTracking().AnyAsync(
            ur => ur.TenantId == tenantId && ur.UserId == userId && ur.RoleId == roleId,
            ct);

    public async Task<bool> RemoveAsync(Guid tenantId, Guid userId, Guid roleId, CancellationToken ct)
    {
        var assignment = await _db.UserRoles
            .FirstOrDefaultAsync(
                ur => ur.TenantId == tenantId && ur.UserId == userId && ur.RoleId == roleId,
                ct)
            .ConfigureAwait(false);
        if (assignment is null)
        {
            return false;
        }

        _db.UserRoles.Remove(assignment);
        return true;
    }
}
