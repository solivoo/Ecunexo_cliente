namespace EcuNexo.Business.Repairs.Storage;

public sealed record PresignedUploadResponse(
    string UploadUrl,
    string S3Bucket,
    string S3Key,
    string ContentType,
    int ExpiresInSeconds);

public sealed record PresignedDownloadResponse(
    string DownloadUrl,
    int ExpiresInSeconds);

public interface IAwsS3StorageService
{
    PresignedUploadResponse GeneratePresignedUploadUrl(
        Guid tenantId,
        Guid batchId,
        string serialNumber,
        string stage,
        string fileName,
        string contentType = "image/webp",
        int expiresInMinutes = 10);

    PresignedDownloadResponse GeneratePresignedDownloadUrl(
        string s3Bucket,
        string s3Key,
        int expiresInMinutes = 15);

    Task DeleteObjectAsync(string s3Bucket, string s3Key, CancellationToken ct);
}
