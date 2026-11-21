using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Reservations.CancelStockReservation;

public sealed record CancelStockReservationCommand(
    Guid TenantId,
    Guid ReservationId,
    string? Reason = null,
    Guid? UserId = null) : ICommand<StockReservationDto>;

public sealed class CancelStockReservationHandler
    : ICommandHandler<CancelStockReservationCommand, StockReservationDto>
{
    private readonly IStockReservationRepository _reservations;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public CancelStockReservationHandler(
        IStockReservationRepository reservations,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _reservations = reservations;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StockReservationDto>> Handle(
        CancelStockReservationCommand command,
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

        var cancelResult = reservation.Cancel(command.Reason, command.UserId);
        if (cancelResult.IsFailure)
        {
            return Result.Failure<StockReservationDto>(cancelResult.Error!);
        }

        foreach (var item in reservation.Items)
        {
            var stock = await _stocks
                .GetTrackedAsync(command.TenantId, item.CatalogItemId, reservation.WarehouseId, ct)
                .ConfigureAwait(false);
            if (stock is not null)
            {
                var releaseResult = stock.ReleaseReservation(item.Quantity, command.UserId);
                if (releaseResult.IsFailure)
                {
                    return Result.Failure<StockReservationDto>(releaseResult.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(StockReservationMapper.ToDto(reservation));
    }
}
