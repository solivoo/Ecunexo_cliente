using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs;

public sealed record RepairEquipmentPhotoResponse(
    Guid Id,
    Guid EquipmentId,
    PhotoStage Stage,
    string S3Bucket,
    string S3Key,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string? Caption,
    DateTimeOffset CapturedAt,
    string DownloadUrl);
