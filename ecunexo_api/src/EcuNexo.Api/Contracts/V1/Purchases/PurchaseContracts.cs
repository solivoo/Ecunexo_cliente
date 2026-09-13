using EcuNexo.Core.Purchases;

namespace EcuNexo.Api.Contracts.V1.Purchases;

public sealed record CreateSupplierApiRequest(
    string BusinessName,
    string TaxId,
    SupplierIdentificationType IdentificationType = SupplierIdentificationType.Ruc,
    SupplierTaxRegime TaxRegime = SupplierTaxRegime.General,
    string? TradeName = null,
    bool IsRetentionAgent = false,
    string? ResolutionNumber = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    int CreditDays = 0,
    decimal? CreditLimit = null,
    string? BankName = null,
    string? BankAccountType = null,
    string? BankAccountNumber = null,
    string? Notes = null);

public sealed record UpdateSupplierApiRequest(
    string BusinessName,
    string TaxId,
    SupplierIdentificationType IdentificationType,
    SupplierTaxRegime TaxRegime,
    string? TradeName = null,
    bool IsRetentionAgent = false,
    string? ResolutionNumber = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    int CreditDays = 0,
    decimal? CreditLimit = null,
    string? BankName = null,
    string? BankAccountType = null,
    string? BankAccountNumber = null,
    string? Notes = null,
    bool IsActive = true);

public sealed record CreateExpenseTypeApiRequest(
    string Code,
    string Name,
    string SriSustentoCode = "01",
    bool AffectsInventory = false,
    string? SuggestedRetentionCode = null,
    decimal? RetentionPercentage = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null,
    string? Description = null);

public sealed record UpdateExpenseTypeApiRequest(
    string Name,
    string SriSustentoCode = "01",
    bool AffectsInventory = false,
    string? SuggestedRetentionCode = null,
    decimal? RetentionPercentage = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null,
    string? Description = null,
    string? Code = null,
    bool? IsActive = null);

public sealed record CreatePurchaseProformaItemApiRequest(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate = 15.00m,
    Guid? CatalogItemId = null,
    Guid? ExpenseTypeId = null);

public sealed record CreatePurchaseProformaApiRequest(
    Guid SupplierId,
    string ProformaNumber,
    DateOnly IssueDate,
    DateOnly? ExpirationDate = null,
    string? Notes = null,
    string? AttachmentUrl = null,
    string? AttachmentFileName = null,
    decimal Subtotal = 0,
    decimal TaxAmount = 0,
    decimal TotalAmount = 0,
    IReadOnlyList<CreatePurchaseProformaItemApiRequest>? Items = null);

public sealed record RejectPurchaseProformaApiRequest(string? Reason = null);

public sealed record ParseSriPurchaseXmlApiRequest(string XmlContent);

public sealed record CreatePurchaseItemApiRequest(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount = 0m,
    decimal TaxRate = 15m,
    string? ItemCode = null,
    Guid? CatalogItemId = null,
    Guid? WarehouseId = null,
    bool AffectsInventory = false);

public sealed record CreatePurchaseApiRequest(
    Guid SupplierId,
    string InvoiceNumber,
    DateOnly IssueDate,
    string DocumentType = "01",
    string? AuthorizationNumber = null,
    Guid? ExpenseTypeId = null,
    string SriSustentoCode = "01",
    decimal SubtotalZero = 0m,
    decimal SubtotalTaxed = 0m,
    decimal SubtotalNoSubject = 0m,
    decimal SubtotalExempt = 0m,
    decimal TaxRate = 15m,
    decimal TaxAmount = 0m,
    decimal TotalDiscount = 0m,
    decimal TotalAmount = 0m,
    string? PaymentMethodCode = null,
    int CreditDays = 0,
    Guid? ProformaId = null,
    string? RawXml = null,
    string? Notes = null,
    IReadOnlyList<CreatePurchaseItemApiRequest>? Items = null);

public sealed record ReceivePurchaseLineMappingApiRequest(
    Guid LineId,
    Guid CatalogItemId,
    Guid WarehouseId);

public sealed record ReceivePurchaseApiRequest(
    Guid? DefaultWarehouseId = null,
    IReadOnlyList<ReceivePurchaseLineMappingApiRequest>? LineMappings = null);

