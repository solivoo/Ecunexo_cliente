using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;

public sealed class ApplyAuthorizedInvoiceEgressValidator
    : AbstractValidator<ApplyAuthorizedInvoiceEgressCommand>
{
    public ApplyAuthorizedInvoiceEgressValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.BillingInvoiceId).NotEmpty();
        RuleFor(x => x.Lines).NotNull();
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.CatalogItemId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0);
        });
    }
}
