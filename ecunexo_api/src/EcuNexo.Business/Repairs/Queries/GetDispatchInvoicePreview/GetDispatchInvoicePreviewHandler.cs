using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Queries.GetDispatchInvoicePreview;

public sealed class GetDispatchInvoicePreviewHandler
    : IQueryHandler<GetDispatchInvoicePreviewQuery, DispatchInvoicePreviewResponse>
{
    private readonly IRepairDispatchRepository _dispatchRepository;
    private readonly RepairCatalogServiceEnsurer _catalogEnsurer;

    public GetDispatchInvoicePreviewHandler(
        IRepairDispatchRepository dispatchRepository,
        RepairCatalogServiceEnsurer catalogEnsurer)
    {
        _dispatchRepository = dispatchRepository;
        _catalogEnsurer = catalogEnsurer;
    }

    public async Task<Result<DispatchInvoicePreviewResponse>> Handle(
        GetDispatchInvoicePreviewQuery query,
        CancellationToken ct)
    {
        var dispatch = await _dispatchRepository.GetByIdAsync(query.TenantId, query.DispatchId, ct)
            .ConfigureAwait(false);

        if (dispatch is null)
        {
            return Result.Failure<DispatchInvoicePreviewResponse>(
                new Error("repairs.dispatch.not_found", "El despacho no existe.", ErrorType.NotFound));
        }

        var batch = dispatch.Batch;
        if (batch is null)
        {
            return Result.Failure<DispatchInvoicePreviewResponse>(
                new Error("repairs.batch.not_found", "El lote del despacho no está disponible.", ErrorType.NotFound));
        }

        var customer = batch.Customer;
        string? blocking = null;
        var canInvoice = true;

        if (dispatch.Status != RepairDispatchStatus.Confirmed)
        {
            canInvoice = false;
            blocking = dispatch.Status == RepairDispatchStatus.Invoiced
                ? "Este despacho ya está facturado."
                : "Solo se pueden facturar despachos confirmados.";
        }
        else if (dispatch.InvoiceId.HasValue)
        {
            canInvoice = false;
            blocking = "Este despacho ya tiene una factura vinculada.";
        }

        var equipments = dispatch.Items
            .Select(i => i.Equipment)
            .Where(e => e is not null)
            .Cast<RepairEquipment>()
            .ToList();

        var serials = equipments.Select(e => e.SerialNumber).OrderBy(s => s).ToList();

        var catalogByLevel = await _catalogEnsurer.EnsureAsync(query.TenantId, ct).ConfigureAwait(false);

        var lines = new List<DispatchInvoicePreviewLine>();
        decimal subtotal = 0m;

        foreach (var group in equipments
                     .Where(e => e.DamageLevel is DamageLevel.Level1 or DamageLevel.Level2 or DamageLevel.Level3)
                     .GroupBy(e => e.DamageLevel)
                     .OrderBy(g => g.Key))
        {
            var rate = DispatchInvoicePricing.RateFor(batch, group.Key) ?? 0m;
            if (rate <= 0m)
            {
                canInvoice = false;
                blocking ??= $"Falta tarifa acordada para {DispatchInvoicePricing.LevelDescription(group.Key)}.";
            }

            catalogByLevel.TryGetValue(group.Key, out var catalogItem);
            var mainCode = catalogItem?.Sku ?? RepairCatalogServiceCodes.SkuFor(group.Key);
            var description = catalogItem?.Name ?? DispatchInvoicePricing.LevelDescription(group.Key);

            var qty = group.Count();
            var lineSub = Math.Round(rate * qty, 2, MidpointRounding.AwayFromZero);
            subtotal += lineSub;

            lines.Add(new DispatchInvoicePreviewLine(
                DamageLevel: (int)group.Key,
                Description: description,
                Quantity: qty,
                UnitPrice: rate,
                LineSubtotal: lineSub,
                MainCode: mainCode,
                CatalogItemId: catalogItem?.Id));
        }

        if (lines.Count == 0)
        {
            canInvoice = false;
            blocking ??= "No hay equipos facturables (N1/N2/N3) en este despacho.";
        }

        if (customer is null || string.IsNullOrWhiteSpace(customer.TaxId) || string.IsNullOrWhiteSpace(customer.Name))
        {
            canInvoice = false;
            blocking ??= "El cliente corporativo del lote no tiene RUC/cédula o razón social válidos.";
        }

        var taxRate = DispatchInvoicePricing.DefaultTaxRate;
        var taxTotal = Math.Round(subtotal * (taxRate / 100m), 2, MidpointRounding.AwayFromZero);
        var grandTotal = subtotal + taxTotal;

        var note =
            $"Despacho {dispatch.DispatchNumber} / Lote {batch.BatchNumber}. Series: {string.Join(", ", serials.Take(40))}{(serials.Count > 40 ? "…" : string.Empty)}";

        var counterparty = new DispatchInvoiceCounterparty(
            IdentificationType: customer is null
                ? "04"
                : DispatchInvoicePricing.SriIdentificationType(customer.IdentificationType),
            Identification: customer?.TaxId?.Trim() ?? string.Empty,
            BusinessName: customer?.Name?.Trim() ?? string.Empty,
            Address: customer?.Address,
            Email: customer?.ContactEmail,
            Phone: customer?.ContactPhone);

        return new DispatchInvoicePreviewResponse(
            DispatchId: dispatch.Id,
            DispatchNumber: dispatch.DispatchNumber,
            BatchId: batch.Id,
            BatchNumber: batch.BatchNumber,
            CanInvoice: canInvoice,
            BlockingReason: blocking,
            AdditionalNote: note,
            Subtotal: subtotal,
            TaxTotal: taxTotal,
            GrandTotal: grandTotal,
            TaxRate: taxRate,
            Counterparty: counterparty,
            Lines: lines,
            SerialNumbers: serials);
    }
}
