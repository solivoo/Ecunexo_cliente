using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.LinkEcommerceOrderInvoice;

public sealed class LinkEcommerceOrderInvoiceHandler
    : ICommandHandler<LinkEcommerceOrderInvoiceCommand, LinkEcommerceOrderInvoiceResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public LinkEcommerceOrderInvoiceHandler(
        IEcommerceOrderRepository orders,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<LinkEcommerceOrderInvoiceResponse>> Handle(
        LinkEcommerceOrderInvoiceCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<LinkEcommerceOrderInvoiceResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        if (command.BillingInvoiceId == Guid.Empty)
        {
            return Result.Failure<LinkEcommerceOrderInvoiceResponse>(
                new Error("ecommerce.order.invoice_empty", "El id de la factura es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<LinkEcommerceOrderInvoiceResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var linkResult = order.LinkBillingInvoice(command.BillingInvoiceId, command.UserId);
        if (linkResult.IsFailure)
        {
            return Result.Failure<LinkEcommerceOrderInvoiceResponse>(linkResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new LinkEcommerceOrderInvoiceResponse(order.Id, command.BillingInvoiceId);
    }
}
