using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RepairEquipmentRepository : IRepairEquipmentRepository
{
    private readonly EcuNexoDbContext _db;

    public RepairEquipmentRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddRangeAsync(IEnumerable<RepairEquipment> equipments, CancellationToken ct)
    {
        _db.RepairEquipments.AddRange(equipments);
        return Task.CompletedTask;
    }

    public Task<RepairEquipment?> GetByIdAsync(Guid tenantId, Guid equipmentId, CancellationToken ct) =>
        _db.RepairEquipments.AsNoTracking()
            .Include(e => e.Batch)
                .ThenInclude(b => b!.Customer)
            .Include(e => e.Photos)
            .Include(e => e.Events)
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.Id == equipmentId, ct);

    public Task<RepairEquipment?> GetTrackedAsync(Guid tenantId, Guid equipmentId, CancellationToken ct) =>
        _db.RepairEquipments
            .Include(e => e.Batch)
            .Include(e => e.Photos)
            .Include(e => e.Events)
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.Id == equipmentId, ct);

    public async Task<IReadOnlyList<RepairEquipment>> ListByBatchAsync(
        Guid tenantId,
        Guid batchId,
        RepairEquipmentStatus? status,
        CancellationToken ct)
    {
        var query = _db.RepairEquipments.AsNoTracking()
            .Include(e => e.Photos)
            .Where(e => e.TenantId == tenantId && e.BatchId == batchId);

        if (status.HasValue)
        {
            query = query.Where(e => e.Status == status.Value);
        }

        return await query
            .OrderBy(e => e.SerialNumber)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<RepairEquipment>> SearchBySerialAsync(
        Guid tenantId,
        string query,
        Guid? customerId,
        CancellationToken ct)
    {
        var pattern = $"%{query.Trim()}%";
        var q = _db.RepairEquipments.AsNoTracking()
            .Include(e => e.Batch)
                .ThenInclude(b => b!.Customer)
            .Where(e => e.TenantId == tenantId && (EF.Functions.ILike(e.SerialNumber, pattern) || EF.Functions.ILike(e.Model, pattern)));

        if (customerId.HasValue)
        {
            q = q.Where(e => e.Batch!.CustomerId == customerId.Value);
        }

        return await q
            .Take(50)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsSerialInBatchAsync(Guid batchId, string serialNumber, CancellationToken ct) =>
        _db.RepairEquipments.AsNoTracking()
            .AnyAsync(e => e.BatchId == batchId && EF.Functions.ILike(e.SerialNumber, serialNumber), ct);

    public Task AddEventAsync(RepairEquipmentEvent @event, CancellationToken ct)
    {
        _db.RepairEquipmentEvents.Add(@event);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<RepairEquipmentEvent>> ListEventsAsync(Guid equipmentId, CancellationToken ct) =>
        await _db.RepairEquipmentEvents.AsNoTracking()
            .Where(ev => ev.EquipmentId == equipmentId)
            .OrderByDescending(ev => ev.OccurredAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task AddPhotoAsync(RepairEquipmentPhoto photo, CancellationToken ct)
    {
        _db.RepairEquipmentPhotos.Add(photo);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<RepairEquipmentPhoto>> ListPhotosAsync(Guid equipmentId, CancellationToken ct) =>
        await _db.RepairEquipmentPhotos.AsNoTracking()
            .Where(p => p.EquipmentId == equipmentId)
            .OrderByDescending(p => p.CapturedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<RepairEquipmentPhoto?> GetPhotoByIdAsync(Guid photoId, CancellationToken ct) =>
        _db.RepairEquipmentPhotos
            .FirstOrDefaultAsync(p => p.Id == photoId, ct);

    public Task RemovePhotoAsync(RepairEquipmentPhoto photo, CancellationToken ct)
    {
        _db.RepairEquipmentPhotos.Remove(photo);
        return Task.CompletedTask;
    }
}
