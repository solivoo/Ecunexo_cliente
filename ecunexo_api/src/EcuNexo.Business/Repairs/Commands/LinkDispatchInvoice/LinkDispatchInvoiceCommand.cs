using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Repairs.Commands.LinkDispatchInvoice;

public sealed record LinkDispatchInvoiceCommand(
    Guid TenantId,
    Guid DispatchId,
    Guid InvoiceId,
    Guid? ModifiedBy = null) : ICommand<LinkDispatchInvoiceResponse>;

public sealed record LinkDispatchInvoiceResponse(
    Guid DispatchId,
    Guid InvoiceId,
    int Status,
    int InvoicedEquipmentCount);
