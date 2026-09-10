using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Ítem / equipo incluido dentro de una orden de despacho o acta de entrega.
/// </summary>
public sealed class RepairDispatchItem : Entity<Guid>
{
    private RepairDispatchItem()
    {
    }

    public Guid DispatchId { get; private set; }

    public RepairDispatch? Dispatch { get; private set; }

    public Guid EquipmentId { get; private set; }

    public RepairEquipment? Equipment { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static RepairDispatchItem Create(Guid id, Guid dispatchId, Guid equipmentId)
    {
        return new RepairDispatchItem
        {
            Id = id,
            DispatchId = dispatchId,
            EquipmentId = equipmentId,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}
