using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.CreateRepairDispatch;

public sealed class CreateRepairDispatchHandler : ICommandHandler<CreateRepairDispatchCommand, CreateRepairDispatchResponse>
{
    private readonly IRepairBatchRepository _batchRepository;
    private readonly IRepairDispatchRepository _dispatchRepository;
    private readonly IRepairEquipmentRepository _equipmentRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateRepairDispatchHandler(
        IRepairBatchRepository batchRepository,
        IRepairDispatchRepository dispatchRepository,
        IRepairEquipmentRepository equipmentRepository,
        IUnitOfWork unitOfWork)
    {
        _batchRepository = batchRepository;
        _dispatchRepository = dispatchRepository;
        _equipmentRepository = equipmentRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateRepairDispatchResponse>> Handle(CreateRepairDispatchCommand command, CancellationToken ct)
    {
        if (command.EquipmentIds.Count == 0)
        {
            return Result.Failure<CreateRepairDispatchResponse>(new Error("repairs.dispatch.empty_selection", "Debe seleccionar al menos un equipo para generar el acta de salida.", ErrorType.Validation));
        }

        var batch = await _batchRepository.GetTrackedWithEquipmentsAsync(command.TenantId, command.BatchId, ct).ConfigureAwait(false);
        if (batch == null)
        {
            return Result.Failure<CreateRepairDispatchResponse>(new Error("repairs.batch.not_found", "El lote especificado no existe.", ErrorType.NotFound));
        }

        var selectedEquipments = batch.Equipments
            .Where(e => command.EquipmentIds.Contains(e.Id))
            .ToList();

        if (selectedEquipments.Count != command.EquipmentIds.Count)
        {
            return Result.Failure<CreateRepairDispatchResponse>(new Error("repairs.dispatch.equipments_mismatch", "Uno o más equipos seleccionados no pertenecen a este lote.", ErrorType.Validation));
        }

        // Validar que los equipos estén en un estado elegible según el tipo de egreso
        var eligibleStatuses = GetEligibleStatuses(command.ExitType);
        var notEligible = selectedEquipments.FirstOrDefault(e => !eligibleStatuses.Contains(e.Status));
        if (notEligible != null)
        {
            var expectedLabel = string.Join(", ", eligibleStatuses.Select(s => s.ToString()));
            return Result.Failure<CreateRepairDispatchResponse>(new Error(
                "repairs.dispatch.equipment_not_eligible",
                $"El equipo '{notEligible.SerialNumber}' no está en un estado válido para el tipo de salida '{command.ExitType}'. Estado actual: {notEligible.Status}. Esperado: {expectedLabel}.",
                ErrorType.Validation));
        }

        var dispatchId = Guid.NewGuid();
        var dispatchResult = RepairDispatch.Create(
            dispatchId,
            command.TenantId,
            command.BatchId,
            command.DispatchNumber,
            command.ExitType,
            command.CarrierName,
            command.CarrierDocument,
            command.CarrierVehiclePlate,
            command.Notes,
            command.CreatedBy);

        if (dispatchResult.IsFailure)
        {
            return Result.Failure<CreateRepairDispatchResponse>(dispatchResult.Error!);
        }

        var dispatch = dispatchResult.Value!;

        foreach (var eq in selectedEquipments)
        {
            var item = RepairDispatchItem.Create(Guid.NewGuid(), dispatchId, eq.Id);
            dispatch.AddItem(item);

            var fromStatus = eq.Status;
            var transitionResult = ApplyEquipmentTransition(eq, command.ExitType, command.ReturnReason, command.CreatedBy);
            if (transitionResult.IsFailure)
            {
                return Result.Failure<CreateRepairDispatchResponse>(transitionResult.Error!);
            }

            var eventNote = BuildEventNote(dispatch.DispatchNumber, command.ExitType, command.ReturnReason);
            var @event = RepairEquipmentEvent.Record(
                Guid.NewGuid(),
                eq.Id,
                fromStatus,
                eq.Status,
                eventNote,
                command.CreatedBy);

            await _equipmentRepository.AddEventAsync(@event, ct).ConfigureAwait(false);
        }

        var confirmResult = dispatch.Confirm(
            command.CarrierName,
            command.CarrierDocument,
            command.CarrierVehiclePlate,
            command.CreatedBy);

        if (confirmResult.IsFailure)
        {
            return Result.Failure<CreateRepairDispatchResponse>(confirmResult.Error!);
        }

        // Recalcular contadores del lote
        var allEquipments = batch.Equipments;
        var total = allEquipments.Count;
        var received = allEquipments.Count(e => e.Status == RepairEquipmentStatus.Received || e.Status == RepairEquipmentStatus.Diagnosing);
        var inRepair = allEquipments.Count(e => e.Status == RepairEquipmentStatus.InRepair || e.Status == RepairEquipmentStatus.QualityCheck);
        var ready = allEquipments.Count(e => e.Status == RepairEquipmentStatus.ReadyToDispatch);
        var dispatched = allEquipments.Count(e =>
            e.Status == RepairEquipmentStatus.Dispatched ||
            e.Status == RepairEquipmentStatus.Invoiced ||
            e.Status == RepairEquipmentStatus.Irreparable ||
            e.Status == RepairEquipmentStatus.ReturnedUnrepaired ||
            e.Status == RepairEquipmentStatus.ReturnedClient);

        batch.RecalculateCounters(total, received, inRepair, ready, dispatched);

        await _dispatchRepository.AddAsync(dispatch, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new CreateRepairDispatchResponse(
            DispatchId: dispatch.Id,
            DispatchNumber: dispatch.DispatchNumber,
            VerificationHash: dispatch.VerificationHash,
            DispatchedCount: selectedEquipments.Count,
            DispatchedAt: dispatch.DispatchedAt ?? DateTimeOffset.UtcNow);
    }

    /// <summary>Retorna los estados de equipo elegibles para cada tipo de egreso.</summary>
    private static IReadOnlyList<RepairEquipmentStatus> GetEligibleStatuses(DispatchExitType exitType) =>
        exitType switch
        {
            DispatchExitType.Repaired => [RepairEquipmentStatus.ReadyToDispatch],
            DispatchExitType.Irreparable => [RepairEquipmentStatus.Irreparable],
            DispatchExitType.ClientRequest =>
            [
                RepairEquipmentStatus.Received,
                RepairEquipmentStatus.Diagnosing,
                RepairEquipmentStatus.InRepair,
                RepairEquipmentStatus.QualityCheck,
                RepairEquipmentStatus.Irreparable,
            ],
            DispatchExitType.TechRefusal =>
            [
                RepairEquipmentStatus.Received,
                RepairEquipmentStatus.Diagnosing,
                RepairEquipmentStatus.InRepair,
                RepairEquipmentStatus.QualityCheck,
                RepairEquipmentStatus.Irreparable,
            ],
            _ => [RepairEquipmentStatus.ReadyToDispatch],
        };

    /// <summary>Aplica la transición de estado correcta según el tipo de egreso.</summary>
    private static Result ApplyEquipmentTransition(
        RepairEquipment eq,
        DispatchExitType exitType,
        string? reason,
        Guid? modifiedBy) =>
        exitType switch
        {
            DispatchExitType.Repaired => eq.MarkDispatched(modifiedBy),
            DispatchExitType.Irreparable => eq.MarkReturnedUnrepaired(reason, modifiedBy),
            DispatchExitType.ClientRequest => eq.MarkReturnedClient(reason, modifiedBy),
            DispatchExitType.TechRefusal => eq.MarkReturnedClient(reason, modifiedBy),
            _ => eq.MarkDispatched(modifiedBy),
        };

    private static string BuildEventNote(string dispatchNumber, DispatchExitType exitType, string? reason)
    {
        var typeLabel = exitType switch
        {
            DispatchExitType.Repaired => "Despacho reparado",
            DispatchExitType.Irreparable => "Devolución: equipo irreparable",
            DispatchExitType.ClientRequest => "Retiro anticipado por cliente",
            DispatchExitType.TechRefusal => "Rechazo técnico del taller",
            _ => "Salida del taller",
        };
        var note = $"{typeLabel} — Acta {dispatchNumber}";
        if (!string.IsNullOrWhiteSpace(reason))
        {
            note += $" — Motivo: {reason.Trim()}";
        }
        return note;
    }
}
