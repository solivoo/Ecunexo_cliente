using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Reservations.GetStockReservationPaymentProofUrl;

public sealed record GetStockReservationPaymentProofUrlQuery(
    Guid TenantId,
    Guid ReservationId,
    Guid PaymentId) : IQuery<StockReservationPaymentProofUrlDto>;

public sealed class GetStockReservationPaymentProofUrlHandler
    : IQueryHandler<GetStockReservationPaymentProofUrlQuery, StockReservationPaymentProofUrlDto>
{
    private readonly IStockReservationRepository _reservations;
    private readonly IStorageService _storage;

    public GetStockReservationPaymentProofUrlHandler(
        IStockReservationRepository reservations,
        IStorageService storage)
    {
        _reservations = reservations;
        _storage = storage;
    }

    public async Task<Result<StockReservationPaymentProofUrlDto>> Handle(
        GetStockReservationPaymentProofUrlQuery query,
        CancellationToken ct)
    {
        var reservation = await _reservations
            .GetByIdWithDetailsAsync(query.TenantId, query.ReservationId, ct)
            .ConfigureAwait(false);
        if (reservation is null)
        {
            return Result.Failure<StockReservationPaymentProofUrlDto>(
                new Error("ecommerce.reservation.not_found", "Reserva no encontrada.", ErrorType.NotFound));
        }

        var payment = reservation.Payments.FirstOrDefault(p => p.Id == query.PaymentId);
        if (payment is null || string.IsNullOrWhiteSpace(payment.ProofObjectKey))
        {
            return Result.Failure<StockReservationPaymentProofUrlDto>(
                new Error("ecommerce.reservation.proof_not_found", "Comprobante no encontrado para este aporte.", ErrorType.NotFound));
        }

        var url = _storage.GetPresignedDownloadUrl(_storage.PrivateBucket, payment.ProofObjectKey, 10);

        return Result.Success(new StockReservationPaymentProofUrlDto(url));
    }
}
