using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Proformas.Commands.CreatePurchaseProforma;

public sealed record CreatePurchaseProformaItemInput(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    Guid? CatalogItemId,
    Guid? ExpenseTypeId);

public sealed record CreatePurchaseProformaCommand(
    Guid TenantId,
    Guid SupplierId,
    string ProformaNumber,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    string? Notes,
    string? AttachmentUrl,
    string? AttachmentFileName,
    IReadOnlyList<CreatePurchaseProformaItemInput> Items) : ICommand<PurchaseProformaResponse>;
