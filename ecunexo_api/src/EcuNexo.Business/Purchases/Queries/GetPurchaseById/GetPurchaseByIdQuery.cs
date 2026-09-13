using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Queries.GetPurchaseById;

public sealed record PurchaseDetailItemDto(
    Guid Id,
    Guid PurchaseId,
    Guid? CatalogItemId,
    Guid? WarehouseId,
    string ItemCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Subtotal,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Total,
    bool AffectsInventory);

public sealed record PurchaseDetailDto(
    Guid Id,
    Guid TenantId,
    Guid SupplierId,
    string SupplierBusinessName,
    string SupplierTaxId,
    Guid? ExpenseTypeId,
    string? ExpenseTypeName,
    Guid? ProformaId,
    string DocumentType,
    string InvoiceNumber,
    string? AuthorizationNumber,
    DateOnly IssueDate,
    DateTimeOffset RegistrationDate,
    string SriSustentoCode,
    decimal SubtotalZero,
    decimal SubtotalTaxed,
    decimal SubtotalNoSubject,
    decimal SubtotalExempt,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalDiscount,
    decimal TotalAmount,
    string? PaymentMethodCode,
    int CreditDays,
    PurchaseStatus Status,
    Guid? InventoryDocumentId,
    string? RawXml,
    string? Notes,
    IReadOnlyList<PurchaseDetailItemDto> Items,
    DateTimeOffset CreatedAt);

public sealed record GetPurchaseByIdQuery(
    Guid TenantId,
    Guid PurchaseId) : IQuery<PurchaseDetailDto>;

public sealed class GetPurchaseByIdHandler : IQueryHandler<GetPurchaseByIdQuery, PurchaseDetailDto>
{
    private readonly IPurchaseRepository _purchases;

    public GetPurchaseByIdHandler(IPurchaseRepository purchases)
    {
        _purchases = purchases;
    }

    public async Task<Result<PurchaseDetailDto>> Handle(
        GetPurchaseByIdQuery query,
        CancellationToken ct)
    {
        var purchase = await _purchases.GetByIdAsync(query.TenantId, query.PurchaseId, ct).ConfigureAwait(false);
        if (purchase is null)
        {
            return Result.Failure<PurchaseDetailDto>(
                new Error("purchases.get.not_found", "La factura de compra no fue encontrada.", ErrorType.NotFound));
        }

        var items = purchase.Items.Select(i => new PurchaseDetailItemDto(
            Id: i.Id,
            PurchaseId: i.PurchaseId,
            CatalogItemId: i.CatalogItemId,
            WarehouseId: i.WarehouseId,
            ItemCode: i.ItemCode,
            Description: i.Description,
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            Discount: i.Discount,
            Subtotal: i.Subtotal,
            TaxRate: i.TaxRate,
            TaxAmount: i.TaxAmount,
            Total: i.Total,
            AffectsInventory: i.AffectsInventory
        )).ToList();

        var dto = new PurchaseDetailDto(
            Id: purchase.Id,
            TenantId: purchase.TenantId,
            SupplierId: purchase.SupplierId,
            SupplierBusinessName: purchase.Supplier?.BusinessName ?? "Proveedor",
            SupplierTaxId: purchase.Supplier?.TaxId ?? string.Empty,
            ExpenseTypeId: purchase.ExpenseTypeId,
            ExpenseTypeName: purchase.ExpenseType?.Name,
            ProformaId: purchase.ProformaId,
            DocumentType: purchase.DocumentType,
            InvoiceNumber: purchase.InvoiceNumber,
            AuthorizationNumber: purchase.AuthorizationNumber,
            IssueDate: purchase.IssueDate,
            RegistrationDate: purchase.RegistrationDate,
            SriSustentoCode: purchase.SriSustentoCode,
            SubtotalZero: purchase.SubtotalZero,
            SubtotalTaxed: purchase.SubtotalTaxed,
            SubtotalNoSubject: purchase.SubtotalNoSubject,
            SubtotalExempt: purchase.SubtotalExempt,
            TaxRate: purchase.TaxRate,
            TaxAmount: purchase.TaxAmount,
            TotalDiscount: purchase.TotalDiscount,
            TotalAmount: purchase.TotalAmount,
            PaymentMethodCode: purchase.PaymentMethodCode,
            CreditDays: purchase.CreditDays,
            Status: purchase.Status,
            InventoryDocumentId: purchase.InventoryDocumentId,
            RawXml: purchase.RawXml,
            Notes: purchase.Notes,
            Items: items.AsReadOnly(),
            CreatedAt: purchase.CreatedAt
        );

        return Result.Success(dto);
    }
}
