using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Evento inmutable de auditoría para cada transición de estado o asignación de un equipo.
/// </summary>
public sealed class RepairEquipmentEvent : Entity<Guid>
{
    private RepairEquipmentEvent()
    {
    }

    public Guid EquipmentId { get; private set; }

    public Guid? UserId { get; private set; }

    public RepairEquipmentStatus FromStatus { get; private set; }

    public RepairEquipmentStatus ToStatus { get; private set; }

    public string? Note { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public static RepairEquipmentEvent Record(
        Guid id,
        Guid equipmentId,
        RepairEquipmentStatus fromStatus,
        RepairEquipmentStatus toStatus,
        string? note = null,
        Guid? userId = null)
    {
        return new RepairEquipmentEvent
        {
            Id = id,
            EquipmentId = equipmentId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            Note = note?.Trim(),
            UserId = userId,
            OccurredAt = DateTimeOffset.UtcNow,
        };
    }
}
