using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;

public sealed record AuthorizedInvoiceEgressLineInput(
    Guid CatalogItemId,
    decimal Quantity,
    string? ItemKind,
    string? Description = null);

public sealed record ApplyAuthorizedInvoiceEgressCommand(
    Guid TenantId,
    Guid BillingInvoiceId,
    IReadOnlyList<AuthorizedInvoiceEgressLineInput> Lines)
    : ICommand<ApplyAuthorizedInvoiceEgressResponse>;

public sealed record ApplyAuthorizedInvoiceEgressResponse(
    Guid BillingInvoiceId,
    Guid? InventoryDocumentId,
    bool Skipped,
    bool AlreadyApplied,
    string Message);
