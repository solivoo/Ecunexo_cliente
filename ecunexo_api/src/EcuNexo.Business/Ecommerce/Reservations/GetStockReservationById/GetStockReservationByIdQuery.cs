using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Reservations.GetStockReservationById;

public sealed record GetStockReservationByIdQuery(Guid TenantId, Guid ReservationId) : IQuery<StockReservationDto>;

public sealed class GetStockReservationByIdHandler
    : IQueryHandler<GetStockReservationByIdQuery, StockReservationDto>
{
    private readonly IStockReservationRepository _reservations;

    public GetStockReservationByIdHandler(IStockReservationRepository reservations)
    {
        _reservations = reservations;
    }

    public async Task<Result<StockReservationDto>> Handle(GetStockReservationByIdQuery query, CancellationToken ct)
    {
        var reservation = await _reservations
            .GetByIdWithDetailsAsync(query.TenantId, query.ReservationId, ct)
            .ConfigureAwait(false);

        if (reservation is null)
        {
            return Result.Failure<StockReservationDto>(
                new Error("ecommerce.reservation.not_found", "Reserva no encontrada.", ErrorType.NotFound));
        }

        return Result.Success(StockReservationMapper.ToDto(reservation));
    }
}
