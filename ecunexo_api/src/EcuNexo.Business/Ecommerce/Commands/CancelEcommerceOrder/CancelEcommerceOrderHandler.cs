using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;

public sealed class CancelEcommerceOrderHandler
    : ICommandHandler<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public CancelEcommerceOrderHandler(
        IEcommerceOrderRepository orders,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CancelEcommerceOrderResponse>> Handle(
        CancelEcommerceOrderCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<CancelEcommerceOrderResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(command.Reason))
        {
            return Result.Failure<CancelEcommerceOrderResponse>(
                new Error("ecommerce.order.cancel_reason_required", "El motivo de anulación es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<CancelEcommerceOrderResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var cancelResult = order.Cancel(command.Reason, command.UserId, command.UserName);
        if (cancelResult.IsFailure)
        {
            return Result.Failure<CancelEcommerceOrderResponse>(cancelResult.Error!);
        }

        // Liberar la reserva de stock de cada producto en la bodega
        foreach (var item in order.Items)
        {
            var stock = await _stocks.GetTrackedAsync(command.TenantId, item.CatalogItemId, order.WarehouseId, ct).ConfigureAwait(false);
            if (stock is not null)
            {
                var releaseResult = stock.ReleaseReservation(item.Quantity, command.UserId);
                if (releaseResult.IsFailure)
                {
                    return Result.Failure<CancelEcommerceOrderResponse>(releaseResult.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new CancelEcommerceOrderResponse(
            order.Id,
            order.Status,
            order.CancellationReason ?? command.Reason,
            order.CancelledAt);
    }
}
