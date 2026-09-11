using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.ShipEcommerceOrder;

public sealed class ShipEcommerceOrderHandler
    : ICommandHandler<ShipEcommerceOrderCommand, ShipEcommerceOrderResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public ShipEcommerceOrderHandler(
        IEcommerceOrderRepository orders,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ShipEcommerceOrderResponse>> Handle(
        ShipEcommerceOrderCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<ShipEcommerceOrderResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(command.Carrier))
        {
            return Result.Failure<ShipEcommerceOrderResponse>(
                new Error("ecommerce.order.carrier_required", "El courier o transportista es obligatorio para el despacho.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<ShipEcommerceOrderResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var shipResult = order.MarkShipped(command.Carrier, command.TrackingNumber ?? string.Empty, command.UserId, command.UserName);
        if (shipResult.IsFailure)
        {
            return Result.Failure<ShipEcommerceOrderResponse>(shipResult.Error!);
        }

        foreach (var item in order.Items)
        {
            var stock = await _stocks.GetTrackedAsync(command.TenantId, item.CatalogItemId, order.WarehouseId, ct).ConfigureAwait(false);
            if (stock is not null)
            {
                var commitResult = stock.CommitReservation(item.Quantity, command.UserId);
                if (commitResult.IsFailure)
                {
                    return Result.Failure<ShipEcommerceOrderResponse>(commitResult.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new ShipEcommerceOrderResponse(
            order.Id,
            order.Status,
            order.Shipping.Carrier ?? command.Carrier,
            order.Shipping.TrackingNumber,
            order.ShippedAt);
    }
}
