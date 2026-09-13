using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Repositories;

public interface ISupplierRepository
{
    Task AddAsync(Supplier supplier, CancellationToken ct);
    Task<Supplier?> GetByIdAsync(Guid tenantId, Guid supplierId, CancellationToken ct);
    Task<Supplier?> GetTrackedByIdAsync(Guid tenantId, Guid supplierId, CancellationToken ct);
    Task<Supplier?> GetByTaxIdAsync(Guid tenantId, string taxId, CancellationToken ct);
    Task<IReadOnlyList<Supplier>> ListAsync(Guid tenantId, string? search, bool? activeOnly, CancellationToken ct);
    Task<bool> ExistsByTaxIdAsync(Guid tenantId, string taxId, Guid? excludeId, CancellationToken ct);
    Task<bool> ExistsByBusinessNameAsync(Guid tenantId, string businessName, Guid? excludeId, CancellationToken ct);
}
