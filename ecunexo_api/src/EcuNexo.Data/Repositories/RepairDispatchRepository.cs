using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RepairDispatchRepository : IRepairDispatchRepository
{
    private readonly EcuNexoDbContext _db;

    public RepairDispatchRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(RepairDispatch dispatch, CancellationToken ct)
    {
        _db.RepairDispatches.Add(dispatch);
        return Task.CompletedTask;
    }

    public Task<RepairDispatch?> GetByIdAsync(Guid tenantId, Guid dispatchId, CancellationToken ct) =>
        _db.RepairDispatches.AsNoTracking()
            .Include(d => d.Batch)
                .ThenInclude(b => b!.Customer)
            .Include(d => d.Items)
                .ThenInclude(i => i.Equipment)
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == dispatchId, ct);

    public Task<RepairDispatch?> GetTrackedWithItemsAsync(Guid tenantId, Guid dispatchId, CancellationToken ct) =>
        _db.RepairDispatches
            .Include(d => d.Items)
                .ThenInclude(i => i.Equipment)
            .Include(d => d.Batch)
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == dispatchId, ct);

    public Task<RepairDispatch?> GetByVerificationHashAsync(string verificationHash, CancellationToken ct) =>
        _db.RepairDispatches.AsNoTracking()
            .Include(d => d.Batch)
                .ThenInclude(b => b!.Customer)
            .Include(d => d.Items)
                .ThenInclude(i => i.Equipment)
            .FirstOrDefaultAsync(d => d.VerificationHash == verificationHash, ct);

    public async Task<IReadOnlyList<RepairDispatch>> ListByBatchAsync(Guid tenantId, Guid batchId, CancellationToken ct) =>
        await _db.RepairDispatches.AsNoTracking()
            .Include(d => d.Items)
                .ThenInclude(i => i.Equipment)
            .Where(d => d.TenantId == tenantId && d.BatchId == batchId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<RepairDispatch>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.RepairDispatches.AsNoTracking()
            .Include(d => d.Batch)
                .ThenInclude(b => b!.Customer)
            .Include(d => d.Items)
                .ThenInclude(i => i.Equipment)
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);
}
