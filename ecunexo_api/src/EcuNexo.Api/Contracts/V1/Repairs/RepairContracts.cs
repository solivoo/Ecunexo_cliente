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
    string? CarrierName = null,
    string? CarrierDocument = null,
    string? CarrierVehiclePlate = null,
    string? Notes = null);

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

