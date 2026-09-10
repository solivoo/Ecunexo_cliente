using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.UpdateEquipmentStatus;

public sealed record UpdateEquipmentStatusCommand(
    Guid TenantId,
    Guid EquipmentId,
    RepairEquipmentStatus TargetStatus,
    Guid? TechnicianId = null,
    string? Notes = null,
    DamageLevel? ConfirmedDamageLevel = null,
    decimal? ServiceFee = null,
    Guid? ModifiedBy = null) : ICommand<UpdateEquipmentStatusResponse>;

public sealed record UpdateEquipmentStatusResponse(
    Guid EquipmentId,
    string SerialNumber,
    RepairEquipmentStatus PreviousStatus,
    RepairEquipmentStatus NewStatus,
    DateTimeOffset UpdatedAt);
