using EcuNexo.Core.Warehousing;

namespace EcuNexo.Business.Warehousing;

public interface IWarehouseRepository
{
    Task AddAsync(Warehouse warehouse, CancellationToken ct);

    Task<IReadOnlyList<Warehouse>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<Warehouse?> GetActiveByIdAsync(Guid tenantId, Guid warehouseId, CancellationToken ct);

    Task<Warehouse?> GetTrackedByIdAsync(Guid tenantId, Guid warehouseId, CancellationToken ct);

    Task<Warehouse?> GetTrackedByCodeIgnoreCaseAsync(Guid tenantId, string code, CancellationToken ct);

    Task<Warehouse?> GetTrackedByNameIgnoreCaseAsync(Guid tenantId, string name, CancellationToken ct);

    Task<bool> NameExistsIgnoreCaseAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct);

    Task<bool> CodeExistsIgnoreCaseAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);

    Task<bool> HasMainAsync(Guid tenantId, CancellationToken ct);

    Task<bool> HasSystemRoleAsync(Guid tenantId, WarehouseSystemRole role, CancellationToken ct);

    Task<Warehouse?> GetActiveSystemByRoleAsync(Guid tenantId, WarehouseSystemRole role, CancellationToken ct);

    Task<Warehouse?> GetMainAsync(Guid tenantId, CancellationToken ct);
}
