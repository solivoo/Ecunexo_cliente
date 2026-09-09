using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RoleRepository : IRoleRepository
{
    private readonly EcuNexoDbContext _db;

    public RoleRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Role role, CancellationToken ct)
    {
        _db.Roles.Add(role);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Role>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Roles.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            .OrderBy(r => r.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<Role?> GetActiveByIdAsync(Guid tenantId, Guid roleId, CancellationToken ct) =>
        _db.Roles.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId && r.DeletedAt == null, ct);

    public Task<Role?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid roleId, CancellationToken ct) =>
        _db.Roles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == roleId && r.DeletedAt == null, ct);

    public async Task<bool> NameExistsIgnoreCaseAsync(
        Guid tenantId,
        string name,
        CancellationToken ct,
        Guid? excludeRoleId = null)
    {
        var trimmed = name.Trim();
        var query = _db.Roles.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null);
        if (excludeRoleId is Guid excludeId)
        {
            query = query.Where(r => r.Id != excludeId);
        }

        var names = await query
            .Select(r => r.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return names.Exists(n => string.Equals(n, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid roleId, CancellationToken ct) =>
        _db.Roles.AsNoTracking().AnyAsync(
            r => r.TenantId == tenantId && r.Id == roleId && r.DeletedAt == null,
            ct);
}
