using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Reservations;

public interface IStockReservationRepository
{
    Task<IReadOnlyList<StockReservation>> ListAsync(
        Guid tenantId,
        StockReservationStatus? status,
        string? search,
        CancellationToken ct);

    Task<StockReservation?> GetByIdWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct);

    Task<StockReservation?> GetTrackedWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct);

    Task<string> GenerateNextNumberAsync(Guid tenantId, CancellationToken ct);

    Task AddAsync(StockReservation reservation, CancellationToken ct);
}
