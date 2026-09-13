using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Repositories;

public interface IPurchaseProformaRepository
{
    Task AddAsync(PurchaseProforma proforma, CancellationToken ct);
    Task<PurchaseProforma?> GetByIdAsync(Guid tenantId, Guid proformaId, CancellationToken ct);
    Task<PurchaseProforma?> GetTrackedByIdAsync(Guid tenantId, Guid proformaId, CancellationToken ct);
    Task<IReadOnlyList<PurchaseProforma>> ListAsync(
        Guid tenantId,
        Guid? supplierId,
        PurchaseProformaStatus? status,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct);
    Task<bool> ExistsByNumberAsync(Guid tenantId, Guid supplierId, string proformaNumber, Guid? excludeId, CancellationToken ct);
}
