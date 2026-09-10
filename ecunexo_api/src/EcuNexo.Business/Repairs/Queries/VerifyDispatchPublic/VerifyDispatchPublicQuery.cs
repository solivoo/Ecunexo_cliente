using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Repairs.Queries.VerifyDispatchPublic;

public sealed record PublicDispatchEquipmentItem(
    string SerialNumber,
    string Model,
    string Brand,
    string DamageLevel);

public sealed record PublicDispatchVerificationResponse(
    string DispatchNumber,
    string CustomerName,
    string Status,
    string? CarrierName,
    string? CarrierVehiclePlate,
    DateTimeOffset? DispatchedAt,
    int TotalEquipments,
    IReadOnlyList<PublicDispatchEquipmentItem> Equipments);

public sealed record VerifyDispatchPublicQuery(string VerificationHash) : IQuery<PublicDispatchVerificationResponse>;

public sealed class VerifyDispatchPublicHandler : IQueryHandler<VerifyDispatchPublicQuery, PublicDispatchVerificationResponse>
{
    private readonly IRepairDispatchRepository _dispatchRepository;

    public VerifyDispatchPublicHandler(IRepairDispatchRepository dispatchRepository)
    {
        _dispatchRepository = dispatchRepository;
    }

    public async Task<Result<PublicDispatchVerificationResponse>> Handle(VerifyDispatchPublicQuery query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.VerificationHash))
        {
            return Result.Failure<PublicDispatchVerificationResponse>(new Error("repairs.verify.hash_empty", "El hash de verificación es obligatorio.", ErrorType.Validation));
        }

        var dispatch = await _dispatchRepository.GetByVerificationHashAsync(query.VerificationHash.Trim().ToLowerInvariant(), ct).ConfigureAwait(false);
        if (dispatch == null)
        {
            return Result.Failure<PublicDispatchVerificationResponse>(new Error("repairs.verify.not_found", "No se encontró ningún despacho con este código de verificación.", ErrorType.NotFound));
        }

        var equipments = dispatch.Items
            .Select(i => new PublicDispatchEquipmentItem(
                SerialNumber: i.Equipment?.SerialNumber ?? string.Empty,
                Model: i.Equipment?.Model ?? string.Empty,
                Brand: i.Equipment?.Brand ?? string.Empty,
                DamageLevel: i.Equipment?.DamageLevel.ToString() ?? string.Empty))
            .ToList();

        return new PublicDispatchVerificationResponse(
            DispatchNumber: dispatch.DispatchNumber,
            CustomerName: dispatch.Batch?.Customer?.Name ?? "Cliente no registrado",
            Status: dispatch.Status.ToString(),
            CarrierName: dispatch.CarrierName,
            CarrierVehiclePlate: dispatch.CarrierVehiclePlate,
            DispatchedAt: dispatch.DispatchedAt,
            TotalEquipments: equipments.Count,
            Equipments: equipments);
    }
}
