using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Reservations.ListStockReservations;

public sealed record ListStockReservationsQuery(
    Guid TenantId,
    StockReservationStatus? Status = null,
    string? Search = null) : IQuery<IReadOnlyList<StockReservationDto>>;

public sealed class ListStockReservationsHandler
    : IQueryHandler<ListStockReservationsQuery, IReadOnlyList<StockReservationDto>>
{
    private readonly IStockReservationRepository _reservations;

    public ListStockReservationsHandler(IStockReservationRepository reservations)
    {
        _reservations = reservations;
    }

    public async Task<Result<IReadOnlyList<StockReservationDto>>> Handle(
        ListStockReservationsQuery query,
        CancellationToken ct)
    {
        if (query.TenantId == Guid.Empty)
        {
            return Result.Failure<IReadOnlyList<StockReservationDto>>(
                new Error("ecommerce.reservation.tenant_empty", "El tenant es obligatorio.", ErrorType.Validation));
        }

        var list = await _reservations.ListAsync(query.TenantId, query.Status, query.Search, ct).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<StockReservationDto>>(list.Select(StockReservationMapper.ToDto).ToList());
    }
}
