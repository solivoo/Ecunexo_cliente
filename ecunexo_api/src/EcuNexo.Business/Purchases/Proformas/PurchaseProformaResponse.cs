using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Proformas;

public sealed record PurchaseProformaItemResponse(
    Guid Id,
    Guid? CatalogItemId,
    Guid? ExpenseTypeId,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal LineTotal)
{
    public static PurchaseProformaItemResponse FromDomain(PurchaseProformaItem item) => new(
        item.Id,
        item.CatalogItemId,
        item.ExpenseTypeId,
        item.Description,
        item.Quantity,
        item.UnitPrice,
        item.TaxRate,
        item.LineTotal);
}

public sealed record PurchaseProformaResponse(
    Guid Id,
    Guid TenantId,
    Guid SupplierId,
    string? SupplierBusinessName,
    string ProformaNumber,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    string? Notes,
    PurchaseProformaStatus Status,
    string Currency,
    decimal Subtotal,
    decimal TaxAmount,
    decimal TotalAmount,
    string? AttachmentUrl,
    string? AttachmentFileName,
    Guid? ConvertedPurchaseId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<PurchaseProformaItemResponse> Items)
{
    public static PurchaseProformaResponse FromDomain(PurchaseProforma p) => new(
        p.Id,
        p.TenantId,
        p.SupplierId,
        p.Supplier?.BusinessName,
        p.ProformaNumber,
        p.IssueDate,
        p.ExpirationDate,
        p.Notes,
        p.Status,
        p.Currency,
        p.Subtotal,
        p.TaxAmount,
        p.TotalAmount,
        p.AttachmentUrl,
        p.AttachmentFileName,
        p.ConvertedPurchaseId,
        p.CreatedAt,
        p.UpdatedAt,
        p.Items.Select(PurchaseProformaItemResponse.FromDomain).ToList());
}
