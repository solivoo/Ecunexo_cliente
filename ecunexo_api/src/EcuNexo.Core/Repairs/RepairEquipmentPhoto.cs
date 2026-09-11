using System.Text.Json.Serialization;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Metadatos de evidencia fotográfica almacenada exclusivamente en Amazon S3 Buckets (Cero-Blobs en BD).
/// </summary>
public sealed class RepairEquipmentPhoto : Entity<Guid>
{
    public const int S3BucketMaxLength = 100;
    public const int S3KeyMaxLength = 400;
    public const int FileNameMaxLength = 200;
    public const int ContentTypeMaxLength = 100;
    public const int CaptionMaxLength = 300;

    private RepairEquipmentPhoto()
    {
    }

    public Guid EquipmentId { get; private set; }

    [JsonIgnore]
    public RepairEquipment? Equipment { get; private set; }

    public Guid? UploadedBy { get; private set; }

    public PhotoStage Stage { get; private set; }

    public string S3Bucket { get; private set; } = string.Empty;

    public string S3Key { get; private set; } = string.Empty;

    public string FileName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = "image/webp";

    public long FileSizeBytes { get; private set; }

    public string? Caption { get; private set; }

    public DateTimeOffset CapturedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static Result<RepairEquipmentPhoto> Create(
        Guid id,
        Guid equipmentId,
        PhotoStage stage,
        string s3Bucket,
        string s3Key,
        string fileName,
        long fileSizeBytes,
        string? contentType = null,
        string? caption = null,
        Guid? uploadedBy = null,
        DateTimeOffset? capturedAt = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RepairEquipmentPhoto>(new Error("repairs.photo.id.empty", "El Id de la foto es obligatorio.", ErrorType.Validation));
        }

        if (equipmentId == Guid.Empty)
        {
            return Result.Failure<RepairEquipmentPhoto>(new Error("repairs.photo.equipment.empty", "El Id del equipo es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(s3Bucket))
        {
            return Result.Failure<RepairEquipmentPhoto>(new Error("repairs.photo.bucket.empty", "El bucket de Amazon S3 es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(s3Key))
        {
            return Result.Failure<RepairEquipmentPhoto>(new Error("repairs.photo.key.empty", "La clave del objeto S3 es obligatoria.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Result.Failure<RepairEquipmentPhoto>(new Error("repairs.photo.filename.empty", "El nombre de archivo es obligatorio.", ErrorType.Validation));
        }

        return new RepairEquipmentPhoto
        {
            Id = id,
            EquipmentId = equipmentId,
            UploadedBy = uploadedBy,
            Stage = stage,
            S3Bucket = s3Bucket.Trim(),
            S3Key = s3Key.Trim(),
            FileName = fileName.Trim(),
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "image/webp" : contentType.Trim(),
            FileSizeBytes = fileSizeBytes,
            Caption = caption?.Trim(),
            CapturedAt = capturedAt ?? DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}
