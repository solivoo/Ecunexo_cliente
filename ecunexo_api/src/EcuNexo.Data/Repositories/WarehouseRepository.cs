using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Warehousing;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class WarehouseRepository : IWarehouseRepository
{
    private readonly EcuNexoDbContext _db;

    public WarehouseRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Warehouse warehouse, CancellationToken ct)
    {
        _db.Warehouses.Add(warehouse);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Warehouse>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Warehouses.AsNoTracking()
            .Where(w => w.TenantId == tenantId && w.DeletedAt == null)
            .OrderByDescending(w => w.IsMain)
            .ThenBy(w => w.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<Warehouse?> GetActiveByIdAsync(Guid tenantId, Guid warehouseId, CancellationToken ct) =>
        _db.Warehouses.AsNoTracking()
            .FirstOrDefaultAsync(
                w => w.TenantId == tenantId && w.Id == warehouseId && w.DeletedAt == null,
                ct);

    public Task<Warehouse?> GetTrackedByIdAsync(Guid tenantId, Guid warehouseId, CancellationToken ct) =>
        _db.Warehouses.FirstOrDefaultAsync(
            w => w.TenantId == tenantId && w.Id == warehouseId && w.DeletedAt == null,
            ct);

    public async Task<Warehouse?> GetTrackedByCodeIgnoreCaseAsync(
        Guid tenantId,
        string code,
        CancellationToken ct)
    {
        var trimmed = code.Trim().ToUpperInvariant();
        var rows = await _db.Warehouses
            .Where(w => w.TenantId == tenantId && w.DeletedAt == null && w.Code != null)
            .ToListAsync(ct)
            .ConfigureAwait(false);
        return rows.Find(w => string.Equals(w.Code, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<Warehouse?> GetTrackedByNameIgnoreCaseAsync(
        Guid tenantId,
        string name,
        CancellationToken ct)
    {
        var trimmed = name.Trim();
        var rows = await _db.Warehouses
            .Where(w => w.TenantId == tenantId && w.DeletedAt == null)
            .ToListAsync(ct)
            .ConfigureAwait(false);
        return rows.Find(w => string.Equals(w.Name, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<bool> NameExistsIgnoreCaseAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct)
    {
        var trimmed = name.Trim();
        var query = _db.Warehouses.AsNoTracking()
            .Where(w => w.TenantId == tenantId && w.DeletedAt == null);
        if (excludeId.HasValue)
        {
            query = query.Where(w => w.Id != excludeId.Value);
        }

        var names = await query.Select(w => w.Name).ToListAsync(ct).ConfigureAwait(false);
        return names.Exists(n => string.Equals(n, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<bool> CodeExistsIgnoreCaseAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct)
    {
        var trimmed = code.Trim().ToUpperInvariant();
        var query = _db.Warehouses.AsNoTracking()
            .Where(w => w.TenantId == tenantId && w.DeletedAt == null && w.Code != null);
        if (excludeId.HasValue)
        {
            query = query.Where(w => w.Id != excludeId.Value);
        }

        var codes = await query.Select(w => w.Code).ToListAsync(ct).ConfigureAwait(false);
        return codes.Exists(c => string.Equals(c, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public Task<bool> HasMainAsync(Guid tenantId, CancellationToken ct) =>
        _db.Warehouses.AsNoTracking().AnyAsync(
            w => w.TenantId == tenantId && w.DeletedAt == null && w.IsMain,
            ct);

    public Task<bool> HasSystemRoleAsync(Guid tenantId, WarehouseSystemRole role, CancellationToken ct) =>
        _db.Warehouses.AsNoTracking().AnyAsync(
            w => w.TenantId == tenantId && w.DeletedAt == null && w.IsSystem && w.SystemRole == role,
            ct);

    public Task<Warehouse?> GetActiveSystemByRoleAsync(Guid tenantId, WarehouseSystemRole role, CancellationToken ct) =>
        _db.Warehouses.AsNoTracking()
            .FirstOrDefaultAsync(
                w => w.TenantId == tenantId
                    && w.DeletedAt == null
                    && w.IsSystem
                    && w.SystemRole == role,
                ct);

    public Task<Warehouse?> GetMainAsync(Guid tenantId, CancellationToken ct) =>
        _db.Warehouses.AsNoTracking()
            .FirstOrDefaultAsync(
                w => w.TenantId == tenantId && w.DeletedAt == null && w.IsMain,
                ct);
}
