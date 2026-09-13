using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Repositories;

public interface IPurchaseRepository
{
    Task AddAsync(Purchase purchase, CancellationToken ct);
    Task<Purchase?> GetByIdAsync(Guid tenantId, Guid purchaseId, CancellationToken ct);
    Task<Purchase?> GetTrackedByIdAsync(Guid tenantId, Guid purchaseId, CancellationToken ct);
    Task<Purchase?> GetByAuthorizationNumberAsync(Guid tenantId, string authorizationNumber, CancellationToken ct);
    Task<IReadOnlyList<Purchase>> ListAsync(
        Guid tenantId,
        Guid? supplierId,
        PurchaseStatus? status,
        DateOnly? from,
        DateOnly? to,
        string? search,
        CancellationToken ct);
    Task<bool> ExistsByInvoiceNumberAsync(Guid tenantId, Guid supplierId, string invoiceNumber, Guid? excludeId, CancellationToken ct);
}
