using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.DeliverEcommerceOrder;

public sealed class DeliverEcommerceOrderHandler
    : ICommandHandler<DeliverEcommerceOrderCommand, DeliverEcommerceOrderResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public DeliverEcommerceOrderHandler(
        IEcommerceOrderRepository orders,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeliverEcommerceOrderResponse>> Handle(
        DeliverEcommerceOrderCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<DeliverEcommerceOrderResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<DeliverEcommerceOrderResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var result = order.MarkDelivered(command.UserId, command.UserName);
        if (result.IsFailure)
        {
            return Result.Failure<DeliverEcommerceOrderResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new DeliverEcommerceOrderResponse(order.Id, order.Status);
    }
}
