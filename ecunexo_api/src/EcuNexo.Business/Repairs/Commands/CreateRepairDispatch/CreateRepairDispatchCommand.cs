using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Commands.CreateRepairDispatch;

public sealed record CreateRepairDispatchCommand(
    Guid TenantId,
    Guid BatchId,
    string DispatchNumber,
    IReadOnlyList<Guid> EquipmentIds,
    DispatchExitType ExitType = DispatchExitType.Repaired,
    string? CarrierName = null,
    string? CarrierDocument = null,
    string? CarrierVehiclePlate = null,
    string? Notes = null,
    string? ReturnReason = null,
    Guid? CreatedBy = null) : ICommand<CreateRepairDispatchResponse>;

public sealed record CreateRepairDispatchResponse(
    Guid DispatchId,
    string DispatchNumber,
    string VerificationHash,
    int DispatchedCount,
    DateTimeOffset DispatchedAt);
