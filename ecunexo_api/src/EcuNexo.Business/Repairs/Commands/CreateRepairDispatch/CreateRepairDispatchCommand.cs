using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Repairs.Commands.CreateRepairDispatch;

public sealed record CreateRepairDispatchCommand(
    Guid TenantId,
    Guid BatchId,
    string DispatchNumber,
    IReadOnlyList<Guid> EquipmentIds,
    string? CarrierName = null,
    string? CarrierDocument = null,
    string? CarrierVehiclePlate = null,
    string? Notes = null,
    Guid? CreatedBy = null) : ICommand<CreateRepairDispatchResponse>;

public sealed record CreateRepairDispatchResponse(
    Guid DispatchId,
    string DispatchNumber,
    string VerificationHash,
    int DispatchedCount,
    DateTimeOffset DispatchedAt);
