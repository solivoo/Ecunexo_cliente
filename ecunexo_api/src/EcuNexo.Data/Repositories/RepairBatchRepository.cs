using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RepairBatchRepository : IRepairBatchRepository
{
    private readonly EcuNexoDbContext _db;

    public RepairBatchRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(RepairBatch batch, CancellationToken ct)
    {
        _db.RepairBatches.Add(batch);
        return Task.CompletedTask;
    }

    public Task<RepairBatch?> GetByIdAsync(Guid tenantId, Guid batchId, CancellationToken ct) =>
        _db.RepairBatches.AsNoTracking()
            .Include(b => b.Customer)
            .Include(b => b.Template)
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == batchId, ct);

    public Task<RepairBatch?> GetTrackedWithEquipmentsAsync(Guid tenantId, Guid batchId, CancellationToken ct) =>
        _db.RepairBatches
            .Include(b => b.Customer)
            .Include(b => b.Equipments)
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == batchId, ct);

    public async Task<IReadOnlyList<RepairBatch>> ListByTenantAsync(
        Guid tenantId,
        Guid? customerId,
        RepairBatchStatus? status,
        CancellationToken ct)
    {
        var query = _db.RepairBatches.AsNoTracking()
            .Include(b => b.Customer)
            .Include(b => b.Template)
            .Where(b => b.TenantId == tenantId);

        if (customerId.HasValue)
        {
            query = query.Where(b => b.CustomerId == customerId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(b => b.Status == status.Value);
        }

        return await query
            .OrderByDescending(b => b.ReceivedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsByBatchNumberAsync(Guid tenantId, string batchNumber, CancellationToken ct) =>
        _db.RepairBatches.AsNoTracking()
            .AnyAsync(b => b.TenantId == tenantId && EF.Functions.ILike(b.BatchNumber, batchNumber), ct);
}
