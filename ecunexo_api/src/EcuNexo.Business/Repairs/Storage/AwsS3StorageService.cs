using EcuNexo.Business.Storage;

namespace EcuNexo.Business.Repairs.Storage;

public sealed class AwsS3StorageService : IAwsS3StorageService
{
    private readonly IStorageService _storageService;

    public AwsS3StorageService(IStorageService storageService)
    {
        _storageService = storageService;
    }

    public PresignedUploadResponse GeneratePresignedUploadUrl(
        Guid tenantId,
        Guid batchId,
        string serialNumber,
        string stage,
        string fileName,
        string contentType = "image/webp",
        int expiresInMinutes = 10)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var safeSerial = Uri.EscapeDataString(serialNumber.Trim().Replace("/", "-"));
        var safeFile = Path.GetFileNameWithoutExtension(fileName).Trim();
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext))
        {
            ext = ".webp";
        }

        var s3Key = $"tenants/{tenantId:N}/batches/{batchId:N}/equipments/{safeSerial}/{stage}_{safeFile}_{timestamp}{ext}";
        var bucket = _storageService.PublicBucket;
        var uploadUrl = _storageService.GetPresignedUploadUrl(bucket, s3Key, contentType, expiresInMinutes);

        return new PresignedUploadResponse(
            UploadUrl: uploadUrl,
            S3Bucket: bucket,
            S3Key: s3Key,
            ContentType: contentType,
            ExpiresInSeconds: expiresInMinutes * 60);
    }

    public PresignedDownloadResponse GeneratePresignedDownloadUrl(
        string s3Bucket,
        string s3Key,
        int expiresInMinutes = 15)
    {
        var bucket = string.IsNullOrWhiteSpace(s3Bucket) ? _storageService.PublicBucket : s3Bucket;
        var downloadUrl = _storageService.GetPublicUrl(bucket, s3Key);

        return new PresignedDownloadResponse(
            DownloadUrl: downloadUrl,
            ExpiresInSeconds: expiresInMinutes * 60);
    }

    public Task DeleteObjectAsync(string s3Bucket, string s3Key, CancellationToken ct)
    {
        var bucket = string.IsNullOrWhiteSpace(s3Bucket) ? _storageService.PublicBucket : s3Bucket;
        return _storageService.DeleteAsync(bucket, s3Key, ct);
    }
}
