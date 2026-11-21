using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storage;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Reservations.AddStockReservationPayment;

public sealed record AddStockReservationPaymentCommand(
    Guid TenantId,
    Guid ReservationId,
    decimal Amount,
    EcommercePaymentMethod PaymentMethod,
    string? Reference,
    string? Notes,
    string? FileName,
    string? ContentType,
    long FileLength,
    Stream? FileContent,
    Guid? RecordedBy = null) : ICommand<StockReservationDto>;

public sealed class AddStockReservationPaymentHandler
    : ICommandHandler<AddStockReservationPaymentCommand, StockReservationDto>
{
    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    private static readonly Dictionary<string, string> ContentTypeByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".webp"] = "image/webp",
        [".pdf"] = "application/pdf",
    };

    private readonly IStockReservationRepository _reservations;
    private readonly IStorageService _storage;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public AddStockReservationPaymentHandler(
        IStockReservationRepository reservations,
        IStorageService storage,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _reservations = reservations;
        _storage = storage;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<StockReservationDto>> Handle(
        AddStockReservationPaymentCommand command,
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

        string? objectKey = null;
        string? normalizedContentType = null;
        var paymentId = _idGenerator.NewId();

        if (command.FileContent is not null && command.FileLength > 0)
        {
            if (command.FileLength > MaxFileSizeBytes)
            {
                return Result.Failure<StockReservationDto>(
                    new Error("ecommerce.reservation.proof_too_large", "El comprobante no puede superar los 5 MB.", ErrorType.PayloadTooLarge));
            }

            var ext = Path.GetExtension(command.FileName ?? string.Empty).ToLowerInvariant();
            if (!ContentTypeByExtension.TryGetValue(ext, out var expectedType))
            {
                return Result.Failure<StockReservationDto>(
                    new Error("ecommerce.reservation.proof_invalid_file", "El comprobante debe ser JPG, PNG, WEBP o PDF.", ErrorType.Validation));
            }

            normalizedContentType = string.IsNullOrWhiteSpace(command.ContentType) ? expectedType : command.ContentType.Trim();
            objectKey = $"tenants/{command.TenantId}/ecommerce/reservations/{command.ReservationId}/aporte-{paymentId:N}{ext}";

            await _storage
                .UploadPrivateAsync(objectKey, command.FileContent, normalizedContentType, ct)
                .ConfigureAwait(false);
        }

        var addResult = reservation.AddPayment(
            paymentId,
            command.Amount,
            command.PaymentMethod,
            command.Reference,
            command.Notes,
            objectKey,
            normalizedContentType,
            command.RecordedBy);

        if (addResult.IsFailure)
        {
            return Result.Failure<StockReservationDto>(addResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(StockReservationMapper.ToDto(reservation));
    }
}
