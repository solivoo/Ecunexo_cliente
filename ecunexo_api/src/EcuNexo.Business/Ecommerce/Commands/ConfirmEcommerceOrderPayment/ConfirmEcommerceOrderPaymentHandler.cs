using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.ConfirmEcommerceOrderPayment;

public sealed class ConfirmEcommerceOrderPaymentHandler
    : ICommandHandler<ConfirmEcommerceOrderPaymentCommand, ConfirmEcommerceOrderPaymentResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public ConfirmEcommerceOrderPaymentHandler(
        IEcommerceOrderRepository orders,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ConfirmEcommerceOrderPaymentResponse>> Handle(
        ConfirmEcommerceOrderPaymentCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<ConfirmEcommerceOrderPaymentResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<ConfirmEcommerceOrderPaymentResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        if (!order.HasStockReserved)
        {
            foreach (var item in order.Items)
            {
                var stock = await _stocks
                    .GetTrackedAsync(command.TenantId, item.CatalogItemId, order.WarehouseId, ct)
                    .ConfigureAwait(false);
                if (stock is null)
                {
                    return Result.Failure<ConfirmEcommerceOrderPaymentResponse>(
                        new Error(
                            "ecommerce.order.stock_missing",
                            $"No existe registro de stock para el producto '{item.Sku}' en la bodega de la orden.",
                            ErrorType.Conflict));
                }

                var reserveResult = stock.Reserve(item.Quantity, command.UserId);
                if (reserveResult.IsFailure)
                {
                    return Result.Failure<ConfirmEcommerceOrderPaymentResponse>(reserveResult.Error!);
                }
            }

            order.MarkStockReserved();
        }

        var result = order.ConfirmPayment(command.PaymentReference, command.UserId, command.UserName);
        if (result.IsFailure)
        {
            return Result.Failure<ConfirmEcommerceOrderPaymentResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new ConfirmEcommerceOrderPaymentResponse(order.Id, order.Status, order.PaymentStatus);
    }
}
