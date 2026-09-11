using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Queries.GetDispatchInvoicePreview;

public sealed record GetDispatchInvoicePreviewQuery(
    Guid TenantId,
    Guid DispatchId) : IQuery<DispatchInvoicePreviewResponse>;

public sealed record DispatchInvoicePreviewLine(
    int DamageLevel,
    string Description,
    int Quantity,
    decimal UnitPrice,
    decimal LineSubtotal,
    string? MainCode,
    Guid? CatalogItemId = null);

public sealed record DispatchInvoiceCounterparty(
    string IdentificationType,
    string Identification,
    string BusinessName,
    string? Address,
    string? Email,
    string? Phone);

public sealed record DispatchInvoicePreviewResponse(
    Guid DispatchId,
    string DispatchNumber,
    Guid BatchId,
    string BatchNumber,
    bool CanInvoice,
    string? BlockingReason,
    string AdditionalNote,
    decimal Subtotal,
    decimal TaxTotal,
    decimal GrandTotal,
    decimal TaxRate,
    DispatchInvoiceCounterparty Counterparty,
    IReadOnlyList<DispatchInvoicePreviewLine> Lines,
    IReadOnlyList<string> SerialNumbers);

internal static class DispatchInvoicePricing
{
    public const decimal DefaultTaxRate = 15m;

    public static decimal? RateFor(RepairBatch batch, DamageLevel level) => level switch
    {
        DamageLevel.Level1 => batch.AgreedRateN1,
        DamageLevel.Level2 => batch.AgreedRateN2,
        DamageLevel.Level3 => batch.AgreedRateN3,
        _ => null,
    };

    public static string LevelDescription(DamageLevel level) => level switch
    {
        DamageLevel.Level1 => "Servicio reacondicionamiento Nivel 1 (leve / estético)",
        DamageLevel.Level2 => "Servicio reacondicionamiento Nivel 2 (medio / chapa)",
        DamageLevel.Level3 => "Servicio reacondicionamiento Nivel 3 (grave / estructural)",
        _ => "Servicio reacondicionamiento",
    };

    public static string SriIdentificationType(CustomerIdentificationType type) => type switch
    {
        CustomerIdentificationType.Cedula => "05",
        CustomerIdentificationType.Pasaporte => "06",
        CustomerIdentificationType.ConsumidorFinal => "07",
        _ => "04",
    };
}
