using EcuNexo.Business.Inventory;
using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class InvoiceStockEgressRepository : IInvoiceStockEgressRepository
{
    private readonly EcuNexoDbContext _db;

    public InvoiceStockEgressRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(InvoiceStockEgress egress, CancellationToken ct)
    {
        _db.InvoiceStockEgresses.Add(egress);
        return Task.CompletedTask;
    }

    public Task<InvoiceStockEgress?> GetByBillingInvoiceAsync(
        Guid tenantId,
        Guid billingInvoiceId,
        CancellationToken ct) =>
        _db.InvoiceStockEgresses.AsNoTracking()
            .FirstOrDefaultAsync(
                e => e.TenantId == tenantId && e.BillingInvoiceId == billingInvoiceId,
                ct);
}
