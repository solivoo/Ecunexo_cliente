using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Commands.ProcessEcommerceOrder;

public sealed class ProcessEcommerceOrderHandler
    : ICommandHandler<ProcessEcommerceOrderCommand, ProcessEcommerceOrderResponse>
{
    private readonly IEcommerceOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;

    public ProcessEcommerceOrderHandler(
        IEcommerceOrderRepository orders,
        IUnitOfWork unitOfWork)
    {
        _orders = orders;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ProcessEcommerceOrderResponse>> Handle(
        ProcessEcommerceOrderCommand command,
        CancellationToken ct)
    {
        if (command.OrderId == Guid.Empty)
        {
            return Result.Failure<ProcessEcommerceOrderResponse>(
                new Error("ecommerce.order.id_empty", "El id de la orden es obligatorio.", ErrorType.Validation));
        }

        var order = await _orders.GetTrackedWithDetailsAsync(command.TenantId, command.OrderId, ct).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<ProcessEcommerceOrderResponse>(
                new Error("ecommerce.order.not_found", "La orden especificada no existe.", ErrorType.NotFound));
        }

        var result = order.MarkProcessing(command.UserId, command.UserName);
        if (result.IsFailure)
        {
            return Result.Failure<ProcessEcommerceOrderResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return new ProcessEcommerceOrderResponse(order.Id, order.Status);
    }
}
