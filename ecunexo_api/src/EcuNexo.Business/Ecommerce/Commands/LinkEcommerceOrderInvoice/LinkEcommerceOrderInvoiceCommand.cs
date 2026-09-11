using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Commands.LinkEcommerceOrderInvoice;

public sealed record LinkEcommerceOrderInvoiceCommand(
    Guid TenantId,
    Guid OrderId,
    Guid BillingInvoiceId,
    Guid? UserId = null) : ICommand<LinkEcommerceOrderInvoiceResponse>;

public sealed record LinkEcommerceOrderInvoiceResponse(
    Guid OrderId,
    Guid BillingInvoiceId);
