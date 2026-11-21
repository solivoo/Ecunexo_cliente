using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Reservations.InvoiceStockReservation;

public sealed record InvoiceStockReservationCommand(
    Guid TenantId,
    Guid ReservationId,
    Guid BillingInvoiceId,
    string? Observation = null,
    Guid? UserId = null) : ICommand<StockReservationDto>;

public sealed class InvoiceStockReservationHandler
    : ICommandHandler<InvoiceStockReservationCommand, StockReservationDto>
{
    private readonly IStockReservationRepository _reservations;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public InvoiceStockReservationHandler(
        IStockReservationRepository reservations,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _reservations = reservations;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StockReservationDto>> Handle(
        InvoiceStockReservationCommand command,
        CancellationToken ct)
    {
        var reservation = await _reservations
            .GetTrackedWithDetailsAsync(command.TenantId, command.ReservationId, ct)
            .ConfigureAwait(false);
        if (reservation is null)
        {
            return Result.Failure<StockReservationDto>(
                new Error("ecommerce.reservation.not_found", "Reserva no encontrada.", ErrorType.NotFound));
        }

        var markResult = reservation.MarkInvoiced(command.BillingInvoiceId, command.Observation, command.UserId);
        if (markResult.IsFailure)
        {
            return Result.Failure<StockReservationDto>(markResult.Error!);
        }

        foreach (var item in reservation.Items)
        {
            var stock = await _stocks
                .GetTrackedAsync(command.TenantId, item.CatalogItemId, reservation.WarehouseId, ct)
                .ConfigureAwait(false);
            if (stock is not null)
            {
                var commitResult = stock.CommitReservation(item.Quantity, command.UserId);
                if (commitResult.IsFailure)
                {
                    return Result.Failure<StockReservationDto>(commitResult.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(StockReservationMapper.ToDto(reservation));
    }
}
