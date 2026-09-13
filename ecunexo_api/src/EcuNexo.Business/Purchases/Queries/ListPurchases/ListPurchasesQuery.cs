using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Queries.ListPurchases;

public sealed record PurchaseSummaryDto(
    Guid Id,
    Guid TenantId,
    Guid SupplierId,
    string SupplierBusinessName,
    string SupplierTaxId,
    string DocumentType,
    string InvoiceNumber,
    string? AuthorizationNumber,
    DateOnly IssueDate,
    string SriSustentoCode,
    decimal SubtotalZero,
    decimal SubtotalTaxed,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalDiscount,
    decimal TotalAmount,
    PurchaseStatus Status,
    Guid? InventoryDocumentId,
    int ItemsCount,
    DateTimeOffset CreatedAt,
    bool AffectsInventory = false,
    string? ExpenseTypeName = null);

public sealed record ListPurchasesKpisDto(
    int TotalPurchases,
    int TotalReceived,
    int TotalDraft,
    decimal TotalBilledAmount);

public sealed record ListPurchasesResponse(
    ListPurchasesKpisDto Kpis,
    IReadOnlyList<PurchaseSummaryDto> Purchases);

public sealed record ListPurchasesQuery(
    Guid TenantId,
    Guid? SupplierId = null,
    PurchaseStatus? Status = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? Search = null) : IQuery<ListPurchasesResponse>;

public sealed class ListPurchasesHandler : IQueryHandler<ListPurchasesQuery, ListPurchasesResponse>
{
    private readonly IPurchaseRepository _purchases;

    public ListPurchasesHandler(IPurchaseRepository purchases)
    {
        _purchases = purchases;
    }

    public async Task<Result<ListPurchasesResponse>> Handle(
        ListPurchasesQuery query,
        CancellationToken ct)
    {
        var list = await _purchases.ListAsync(
            tenantId: query.TenantId,
            supplierId: query.SupplierId,
            status: query.Status,
            from: query.From,
            to: query.To,
            search: query.Search,
            ct: ct).ConfigureAwait(false);

        var total = list.Count;
        var received = list.Count(p => p.Status == PurchaseStatus.Received);
        var draft = list.Count(p => p.Status == PurchaseStatus.Draft);
        var totalAmount = list.Sum(p => p.TotalAmount);

        var kpis = new ListPurchasesKpisDto(
            TotalPurchases: total,
            TotalReceived: received,
            TotalDraft: draft,
            TotalBilledAmount: Math.Round(totalAmount, 2, MidpointRounding.AwayFromZero)
        );

        var dtos = list.Select(p => new PurchaseSummaryDto(
            Id: p.Id,
            TenantId: p.TenantId,
            SupplierId: p.SupplierId,
            SupplierBusinessName: p.Supplier?.BusinessName ?? "Proveedor desconocido",
            SupplierTaxId: p.Supplier?.TaxId ?? string.Empty,
            DocumentType: p.DocumentType,
            InvoiceNumber: p.InvoiceNumber,
            AuthorizationNumber: p.AuthorizationNumber,
            IssueDate: p.IssueDate,
            SriSustentoCode: p.SriSustentoCode,
            SubtotalZero: p.SubtotalZero,
            SubtotalTaxed: p.SubtotalTaxed,
            TaxRate: p.TaxRate,
            TaxAmount: p.TaxAmount,
            TotalDiscount: p.TotalDiscount,
            TotalAmount: p.TotalAmount,
            Status: p.Status,
            InventoryDocumentId: p.InventoryDocumentId,
            ItemsCount: p.Items.Count,
            CreatedAt: p.CreatedAt,
            AffectsInventory: p.Items.Any(i => i.AffectsInventory),
            ExpenseTypeName: p.ExpenseType?.Name
        )).ToList();

        return Result.Success(new ListPurchasesResponse(kpis, dtos.AsReadOnly()));
    }
}
