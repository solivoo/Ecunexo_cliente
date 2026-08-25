using EcuNexo.Core.Inventory;

namespace EcuNexo.Business.Inventory;

public interface IInvoiceStockEgressRepository
{
    Task AddAsync(InvoiceStockEgress egress, CancellationToken ct);

    Task<InvoiceStockEgress?> GetByBillingInvoiceAsync(
        Guid tenantId,
        Guid billingInvoiceId,
        CancellationToken ct);
}
