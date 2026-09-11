using EcuNexo.Core.Repairs;

namespace EcuNexo.Api.Contracts.V1.Repairs;

public sealed record UpdateEquipmentStatusRequest(
    RepairEquipmentStatus TargetStatus,
    Guid? TechnicianId = null,
    string? Notes = null,
    DamageLevel? ConfirmedDamageLevel = null,
    decimal? ServiceFee = null);

public sealed record CreateRepairDispatchRequest(
    Guid BatchId,
    string DispatchNumber,
    List<Guid> EquipmentIds,
    DispatchExitType ExitType = DispatchExitType.Repaired,
    string? CarrierName = null,
    string? CarrierDocument = null,
    string? CarrierVehiclePlate = null,
    string? Notes = null,
    string? ReturnReason = null);

public sealed record LinkDispatchInvoiceRequest(Guid InvoiceId);

public sealed record GeneratePhotoUploadUrlRequest(
    string Stage,
    string FileName,
    string? ContentType = null);

public sealed record ConfirmPhotoUploadRequest(
    PhotoStage Stage,
    string S3Bucket,
    string S3Key,
    string FileName,
    long FileSizeBytes,
    string? ContentType = null,
    string? Caption = null);

public sealed record CreateCustomerRequest(
    string Name,
    string? TaxId = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    string? Notes = null,
    EcuNexo.Core.Customers.CustomerType? CustomerType = null,
    EcuNexo.Core.Customers.CustomerIdentificationType? IdentificationType = null);

public sealed record UpdateCustomerRequest(
    string Name,
    string? TaxId = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    string? Notes = null,
    bool? IsActive = null,
    EcuNexo.Core.Customers.CustomerType? CustomerType = null,
    EcuNexo.Core.Customers.CustomerIdentificationType? IdentificationType = null);

public sealed record ToggleCustomerStatusRequest(bool IsActive);

public sealed record CancelBatchRequest(string Reason);

public sealed record RepairDispatchEquipmentDto(
    Guid Id,
    Guid BatchId,
    string SerialNumber,
    string Model,
    string Brand,
    DamageLevel DamageLevel,
    RepairEquipmentStatus Status,
    decimal? ServiceFeeApplied,
    string? DiagnosticNotes,
    string? RepairNotes);

public sealed record RepairDispatchItemDto(
    Guid Id,
    Guid DispatchId,
    Guid EquipmentId,
    RepairDispatchEquipmentDto? Equipment = null);

public sealed record RepairDispatchDto(
    Guid Id,
    Guid TenantId,
    Guid BatchId,
    string? BatchNumber,
    string? CustomerName,
    string DispatchNumber,
    RepairDispatchStatus Status,
    DispatchExitType ExitType,
    string? CarrierName,
    string? CarrierDocument,
    string? CarrierVehiclePlate,
    string VerificationHash,
    string? QrCodeUrl,
    string? Notes,
    Guid? InvoiceId,
    DateTimeOffset? DispatchedAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<RepairDispatchItemDto> Items);

