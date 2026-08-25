using EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;

namespace EcuNexo.Api.Contracts.V1.Inventory;

public sealed record AuthorizedInvoiceEgressLineRequest(
    Guid CatalogItemId,
    decimal Quantity,
    string? ItemKind,
    string? Description = null);

public sealed record ApplyAuthorizedInvoiceEgressRequest(
    Guid BillingInvoiceId,
    IReadOnlyList<AuthorizedInvoiceEgressLineRequest> Lines)
{
    public ApplyAuthorizedInvoiceEgressCommand ToCommand(Guid tenantId) =>
        new(
            tenantId,
            BillingInvoiceId,
            Lines
                .Select(l => new AuthorizedInvoiceEgressLineInput(
                    l.CatalogItemId,
                    l.Quantity,
                    l.ItemKind,
                    l.Description))
                .ToList());
}
