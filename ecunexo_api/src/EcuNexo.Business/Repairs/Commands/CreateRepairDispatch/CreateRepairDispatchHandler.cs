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
            return Result.Failure<CreateRepairDispatchResponse>(new Error("repairs.dispatch.empty_selection", "Debe seleccionar al menos un equipo para generar el despacho.", ErrorType.Validation));
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

        var notReady = selectedEquipments.FirstOrDefault(e => e.Status != RepairEquipmentStatus.ReadyToDispatch);
        if (notReady != null)
        {
            return Result.Failure<CreateRepairDispatchResponse>(new Error("repairs.dispatch.equipment_not_ready", $"El equipo '{notReady.SerialNumber}' no está en estado 'Listo para Despacho' (estado actual: {notReady.Status}).", ErrorType.Validation));
        }

        var dispatchId = Guid.NewGuid();
        var dispatchResult = RepairDispatch.Create(
            dispatchId,
            command.TenantId,
            command.BatchId,
            command.DispatchNumber,
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

            var dispatchEqResult = eq.MarkDispatched(command.CreatedBy);
            if (dispatchEqResult.IsFailure)
            {
                return Result.Failure<CreateRepairDispatchResponse>(dispatchEqResult.Error!);
            }

            var @event = RepairEquipmentEvent.Record(
                Guid.NewGuid(),
                eq.Id,
                RepairEquipmentStatus.ReadyToDispatch,
                RepairEquipmentStatus.Dispatched,
                $"Incluido en despacho {dispatch.DispatchNumber}",
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
        var dispatched = allEquipments.Count(e => e.Status == RepairEquipmentStatus.Dispatched || e.Status == RepairEquipmentStatus.Invoiced || e.Status == RepairEquipmentStatus.Irreparable);

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
}
