using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Reservations;

public sealed record StockReservationItemDto(
    Guid Id,
    Guid CatalogItemId,
    string Sku,
    string ItemName,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal LineSubtotal,
    decimal LineTax,
    decimal LineTotal);

public sealed record StockReservationPaymentDto(
    Guid Id,
    decimal Amount,
    EcommercePaymentMethod PaymentMethod,
    string? Reference,
    string? Notes,
    bool HasProof,
    string? ProofContentType,
    DateTimeOffset PaidAtUtc);

public sealed record StockReservationDto(
    Guid Id,
    string ReservationNumber,
    Guid WarehouseId,
    string WarehouseName,
    Guid CustomerId,
    string CustomerName,
    string CustomerTaxId,
    string? CustomerEmail,
    string? CustomerPhone,
    StockReservationStatus Status,
    DateTimeOffset ReservedAtUtc,
    DateTimeOffset? ExpiresAtUtc,
    decimal Subtotal,
    decimal TaxAmount,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal BalanceAmount,
    bool IsFullyPaid,
    Guid? BillingInvoiceId,
    string? InvoiceObservation,
    string? Notes,
    DateTimeOffset? InvoicedAtUtc,
    DateTimeOffset? CancelledAtUtc,
    string? CancellationReason,
    IReadOnlyList<StockReservationItemDto> Items,
    IReadOnlyList<StockReservationPaymentDto> Payments);

public sealed record StockReservationPaymentProofUrlDto(string Url);

public static class StockReservationMapper
{
    public static StockReservationDto ToDto(StockReservation r) =>
        new(
            r.Id,
            r.ReservationNumber,
            r.WarehouseId,
            r.Warehouse?.Name ?? string.Empty,
            r.CustomerId,
            r.CustomerName,
            r.CustomerTaxId,
            r.CustomerEmail,
            r.CustomerPhone,
            r.Status,
            r.ReservedAtUtc,
            r.ExpiresAtUtc,
            r.Subtotal,
            r.TaxAmount,
            r.TotalAmount,
            r.PaidAmount,
            r.BalanceAmount,
            r.IsFullyPaid,
            r.BillingInvoiceId,
            r.InvoiceObservation,
            r.Notes,
            r.InvoicedAtUtc,
            r.CancelledAtUtc,
            r.CancellationReason,
            r.Items.Select(i => new StockReservationItemDto(
                i.Id,
                i.CatalogItemId,
                i.Sku,
                i.ItemName,
                i.Quantity,
                i.UnitPrice,
                i.TaxRate,
                i.LineSubtotal,
                i.LineTax,
                i.LineTotal)).ToList(),
            r.Payments.OrderByDescending(p => p.PaidAtUtc).Select(p => new StockReservationPaymentDto(
                p.Id,
                p.Amount,
                p.PaymentMethod,
                p.Reference,
                p.Notes,
                !string.IsNullOrWhiteSpace(p.ProofObjectKey),
                p.ProofContentType,
                p.PaidAtUtc)).ToList());
}
