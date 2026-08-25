using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class DepartmentRepository : IDepartmentRepository
{
    private readonly EcuNexoDbContext _db;

    public DepartmentRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Department department, CancellationToken ct)
    {
        _db.Departments.Add(department);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Department>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Departments.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.DeletedAt == null)
            .OrderBy(d => d.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<Department?> GetActiveByIdAsync(Guid tenantId, Guid departmentId, CancellationToken ct) =>
        _db.Departments.AsNoTracking()
            .FirstOrDefaultAsync(
                d => d.TenantId == tenantId && d.Id == departmentId && d.DeletedAt == null,
                ct);

    public Task<Department?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid departmentId, CancellationToken ct) =>
        _db.Departments.FirstOrDefaultAsync(
            d => d.TenantId == tenantId && d.Id == departmentId && d.DeletedAt == null,
            ct);

    public async Task<bool> NameExistsIgnoreCaseAsync(
        Guid tenantId,
        string name,
        CancellationToken ct,
        Guid? excludeDepartmentId = null)
    {
        var trimmed = name.Trim();
        var query = _db.Departments.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.DeletedAt == null);
        if (excludeDepartmentId is Guid excludeId)
        {
            query = query.Where(d => d.Id != excludeId);
        }

        var names = await query.Select(d => d.Name).ToListAsync(ct).ConfigureAwait(false);
        return names.Exists(n => Department.NamesMatchIgnoreDiacritics(n, trimmed));
    }

    public Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid departmentId, CancellationToken ct) =>
        _db.Departments.AsNoTracking().AnyAsync(
            d => d.TenantId == tenantId && d.Id == departmentId && d.DeletedAt == null,
            ct);
}
