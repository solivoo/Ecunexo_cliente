using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.UpdateEquipmentStatus;

public sealed class UpdateEquipmentStatusHandler : ICommandHandler<UpdateEquipmentStatusCommand, UpdateEquipmentStatusResponse>
{
    private readonly IRepairEquipmentRepository _equipmentRepository;
    private readonly IRepairBatchRepository _batchRepository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateEquipmentStatusHandler(
        IRepairEquipmentRepository equipmentRepository,
        IRepairBatchRepository batchRepository,
        IUnitOfWork unitOfWork)
    {
        _equipmentRepository = equipmentRepository;
        _batchRepository = batchRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateEquipmentStatusResponse>> Handle(UpdateEquipmentStatusCommand command, CancellationToken ct)
    {
        var equipment = await _equipmentRepository.GetTrackedAsync(command.TenantId, command.EquipmentId, ct).ConfigureAwait(false);
        if (equipment == null)
        {
            return Result.Failure<UpdateEquipmentStatusResponse>(new Error("repairs.equipment.not_found", "El equipo especificado no existe.", ErrorType.NotFound));
        }

        var previousStatus = equipment.Status;
        Result transitionResult;

        switch (command.TargetStatus)
        {
            case RepairEquipmentStatus.Diagnosing:
                transitionResult = equipment.StartDiagnosis(command.TechnicianId, command.Notes, command.ModifiedBy);
                break;
            case RepairEquipmentStatus.InRepair:
                if (previousStatus == RepairEquipmentStatus.QualityCheck)
                {
                    transitionResult = equipment.RejectQualityCheck(command.Notes ?? "Rechazado en control de calidad", command.ModifiedBy);
                }
                else
                {
                    transitionResult = equipment.StartRepair(command.Notes, command.ConfirmedDamageLevel, command.ModifiedBy);
                }
                break;
            case RepairEquipmentStatus.QualityCheck:
                transitionResult = equipment.SendToQualityCheck(command.Notes, command.ModifiedBy);
                break;
            case RepairEquipmentStatus.ReadyToDispatch:
                transitionResult = equipment.ApproveQualityCheck(command.Notes, command.ModifiedBy);
                break;
            case RepairEquipmentStatus.Irreparable:
                transitionResult = equipment.MarkIrreparable(command.Notes ?? "Baja técnica", command.ModifiedBy);
                break;
            default:
                return Result.Failure<UpdateEquipmentStatusResponse>(new Error("repairs.equipment.invalid_target", $"Transición a {command.TargetStatus} no permitida directamente por esta acción.", ErrorType.Validation));
        }

        if (transitionResult.IsFailure)
        {
            return Result.Failure<UpdateEquipmentStatusResponse>(transitionResult.Error!);
        }

        if (command.TechnicianId.HasValue && equipment.AssignedTechnicianId != command.TechnicianId.Value)
        {
            equipment.AssignTechnician(command.TechnicianId.Value, command.ModifiedBy);
        }

        var @event = RepairEquipmentEvent.Record(
            Guid.NewGuid(),
            equipment.Id,
            previousStatus,
            equipment.Status,
            command.Notes,
            command.ModifiedBy);

        await _equipmentRepository.AddEventAsync(@event, ct).ConfigureAwait(false);

        // Recalcular contadores del lote
        var batch = await _batchRepository.GetTrackedWithEquipmentsAsync(command.TenantId, equipment.BatchId, ct).ConfigureAwait(false);
        if (batch != null)
        {
            var allEquipments = batch.Equipments;
            var total = allEquipments.Count;
            var received = allEquipments.Count(e => e.Status == RepairEquipmentStatus.Received || e.Status == RepairEquipmentStatus.Diagnosing);
            var inRepair = allEquipments.Count(e => e.Status == RepairEquipmentStatus.InRepair || e.Status == RepairEquipmentStatus.QualityCheck);
            var ready = allEquipments.Count(e => e.Status == RepairEquipmentStatus.ReadyToDispatch);
            var dispatched = allEquipments.Count(e => e.Status == RepairEquipmentStatus.Dispatched || e.Status == RepairEquipmentStatus.Invoiced || e.Status == RepairEquipmentStatus.Irreparable);

            batch.RecalculateCounters(total, received, inRepair, ready, dispatched);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new UpdateEquipmentStatusResponse(
            EquipmentId: equipment.Id,
            SerialNumber: equipment.SerialNumber,
            PreviousStatus: previousStatus,
            NewStatus: equipment.Status,
            UpdatedAt: equipment.UpdatedAt ?? DateTimeOffset.UtcNow);
    }
}
