using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Repositories;

public interface IRepairEquipmentRepository
{
    Task AddRangeAsync(IEnumerable<RepairEquipment> equipments, CancellationToken ct);
    Task<RepairEquipment?> GetByIdAsync(Guid tenantId, Guid equipmentId, CancellationToken ct);
    Task<RepairEquipment?> GetTrackedAsync(Guid tenantId, Guid equipmentId, CancellationToken ct);
    Task<IReadOnlyList<RepairEquipment>> ListByBatchAsync(Guid tenantId, Guid batchId, RepairEquipmentStatus? status, CancellationToken ct);
    Task<IReadOnlyList<RepairEquipment>> SearchBySerialAsync(Guid tenantId, string query, Guid? customerId, CancellationToken ct);
    Task<bool> ExistsSerialInBatchAsync(Guid batchId, string serialNumber, CancellationToken ct);
    Task AddEventAsync(RepairEquipmentEvent @event, CancellationToken ct);
    Task<IReadOnlyList<RepairEquipmentEvent>> ListEventsAsync(Guid equipmentId, CancellationToken ct);
    Task AddPhotoAsync(RepairEquipmentPhoto photo, CancellationToken ct);
    Task<IReadOnlyList<RepairEquipmentPhoto>> ListPhotosAsync(Guid equipmentId, CancellationToken ct);
    Task<RepairEquipmentPhoto?> GetPhotoByIdAsync(Guid photoId, CancellationToken ct);
    Task RemovePhotoAsync(RepairEquipmentPhoto photo, CancellationToken ct);
}
