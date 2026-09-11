using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Queries.GetDispatchInvoicePreview;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.LinkDispatchInvoice;

public sealed class LinkDispatchInvoiceHandler
    : ICommandHandler<LinkDispatchInvoiceCommand, LinkDispatchInvoiceResponse>
{
    private readonly IRepairDispatchRepository _dispatchRepository;
    private readonly IRepairBatchRepository _batchRepository;
    private readonly IRepairEquipmentRepository _equipmentRepository;
    private readonly IUnitOfWork _unitOfWork;

    public LinkDispatchInvoiceHandler(
        IRepairDispatchRepository dispatchRepository,
        IRepairBatchRepository batchRepository,
        IRepairEquipmentRepository equipmentRepository,
        IUnitOfWork unitOfWork)
    {
        _dispatchRepository = dispatchRepository;
        _batchRepository = batchRepository;
        _equipmentRepository = equipmentRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<LinkDispatchInvoiceResponse>> Handle(
        LinkDispatchInvoiceCommand command,
        CancellationToken ct)
    {
        if (command.InvoiceId == Guid.Empty)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error("repairs.dispatch.invoice.empty", "El Id de factura es obligatorio.", ErrorType.Validation));
        }

        var dispatch = await _dispatchRepository
            .GetTrackedWithItemsAsync(command.TenantId, command.DispatchId, ct)
            .ConfigureAwait(false);

        if (dispatch is null)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error("repairs.dispatch.not_found", "El despacho no existe.", ErrorType.NotFound));
        }

        if (dispatch.Status != RepairDispatchStatus.Confirmed)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error(
                    "repairs.dispatch.not_confirmed",
                    "Solo se pueden vincular facturas a despachos confirmados.",
                    ErrorType.Validation));
        }

        if (dispatch.InvoiceId.HasValue)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error(
                    "repairs.dispatch.already_invoiced",
                    "Este despacho ya tiene una factura vinculada.",
                    ErrorType.Conflict));
        }

        var batch = await _batchRepository
            .GetTrackedWithEquipmentsAsync(command.TenantId, dispatch.BatchId, ct)
            .ConfigureAwait(false);

        if (batch is null)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error("repairs.batch.not_found", "El lote del despacho no existe.", ErrorType.NotFound));
        }

        var equipmentIds = dispatch.Items.Select(i => i.EquipmentId).ToHashSet();
        var equipments = batch.Equipments.Where(e => equipmentIds.Contains(e.Id)).ToList();

        if (equipments.Count != equipmentIds.Count)
        {
            return Result.Failure<LinkDispatchInvoiceResponse>(
                new Error(
                    "repairs.dispatch.equipments_mismatch",
                    "No se pudieron resolver todos los equipos del despacho.",
                    ErrorType.Validation));
        }

        foreach (var eq in equipments)
        {
            var rate = DispatchInvoicePricing.RateFor(batch, eq.DamageLevel) ?? 0m;
            var mark = eq.MarkInvoiced(rate, command.ModifiedBy);
            if (mark.IsFailure)
            {
                return Result.Failure<LinkDispatchInvoiceResponse>(mark.Error!);
            }

            var @event = RepairEquipmentEvent.Record(
                Guid.NewGuid(),
                eq.Id,
                RepairEquipmentStatus.Dispatched,
                RepairEquipmentStatus.Invoiced,
                $"Facturado en acta {dispatch.DispatchNumber} (factura {command.InvoiceId:N})",
                command.ModifiedBy);

            await _equipmentRepository.AddEventAsync(@event, ct).ConfigureAwait(false);
        }

        dispatch.LinkInvoice(command.InvoiceId, command.ModifiedBy);

        var all = batch.Equipments;
        var total = all.Count;
        var received = all.Count(e =>
            e.Status is RepairEquipmentStatus.Received or RepairEquipmentStatus.Diagnosing);
        var inRepair = all.Count(e =>
            e.Status is RepairEquipmentStatus.InRepair or RepairEquipmentStatus.QualityCheck);
        var ready = all.Count(e => e.Status == RepairEquipmentStatus.ReadyToDispatch);
        var dispatched = all.Count(e =>
            e.Status is RepairEquipmentStatus.Dispatched
                or RepairEquipmentStatus.Invoiced
                or RepairEquipmentStatus.Irreparable);

        batch.RecalculateCounters(total, received, inRepair, ready, dispatched);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new LinkDispatchInvoiceResponse(
            DispatchId: dispatch.Id,
            InvoiceId: command.InvoiceId,
            Status: (int)dispatch.Status,
            InvoicedEquipmentCount: equipments.Count);
    }
}
