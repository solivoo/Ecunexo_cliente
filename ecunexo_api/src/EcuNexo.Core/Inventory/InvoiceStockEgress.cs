using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Inventory;

/// <summary>
/// Recibo de egreso post-autorización SRI. Garantiza idempotencia por factura Billing (ADR-010 fase 4).
/// </summary>
public sealed class InvoiceStockEgress : AggregateRoot<Guid>, ITenantEntity
{
    private InvoiceStockEgress()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid BillingInvoiceId { get; private set; }

    public Guid InventoryDocumentId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static Result<InvoiceStockEgress> Create(
        Guid id,
        Guid tenantId,
        Guid billingInvoiceId,
        Guid inventoryDocumentId)
    {
        if (tenantId == Guid.Empty || billingInvoiceId == Guid.Empty || inventoryDocumentId == Guid.Empty)
        {
            return Result.Failure<InvoiceStockEgress>(
                new Error(
                    "inventory.billing_egress.keys.invalid",
                    "Tenant, factura Billing y documento son obligatorios.",
                    ErrorType.Validation));
        }

        return new InvoiceStockEgress
        {
            Id = id,
            TenantId = tenantId,
            BillingInvoiceId = billingInvoiceId,
            InventoryDocumentId = inventoryDocumentId,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}
