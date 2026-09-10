namespace EcuNexo.Business.Repairs.Storage;

public sealed class AwsS3StorageService : IAwsS3StorageService
{
    private readonly string _defaultBucket;
    private readonly string _region;

    public AwsS3StorageService(string? defaultBucket = null, string? region = null)
    {
        _defaultBucket = string.IsNullOrWhiteSpace(defaultBucket) ? "ecunexo-repairs-evidence-dev" : defaultBucket;
        _region = string.IsNullOrWhiteSpace(region) ? "us-east-1" : region;
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
        var uploadUrl = $"https://{_defaultBucket}.s3.{_region}.amazonaws.com/{s3Key}?X-Amz-Expires={expiresInMinutes * 60}";

        return new PresignedUploadResponse(
            UploadUrl: uploadUrl,
            S3Bucket: _defaultBucket,
            S3Key: s3Key,
            ContentType: contentType,
            ExpiresInSeconds: expiresInMinutes * 60);
    }

    public PresignedDownloadResponse GeneratePresignedDownloadUrl(
        string s3Bucket,
        string s3Key,
        int expiresInMinutes = 15)
    {
        var bucket = string.IsNullOrWhiteSpace(s3Bucket) ? _defaultBucket : s3Bucket;
        var downloadUrl = $"https://{bucket}.s3.{_region}.amazonaws.com/{s3Key}?X-Amz-Expires={expiresInMinutes * 60}";

        return new PresignedDownloadResponse(
            DownloadUrl: downloadUrl,
            ExpiresInSeconds: expiresInMinutes * 60);
    }

    public Task DeleteObjectAsync(string s3Bucket, string s3Key, CancellationToken ct)
    {
        return Task.CompletedTask;
    }
}
