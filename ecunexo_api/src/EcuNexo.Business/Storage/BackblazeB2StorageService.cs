using Amazon.S3;
using Amazon.S3.Model;

namespace EcuNexo.Business.Storage;

/// <summary>
/// Proveedor de almacenamiento que utiliza la API S3 compatible de Backblaze B2.
/// </summary>
public sealed class BackblazeB2StorageService : IStorageService, IDisposable
{
    private readonly StorageOptions _options;
    private readonly AmazonS3Client _s3Client;
    private bool _disposed;

    public BackblazeB2StorageService(StorageOptions options)
    {
        _options = options;

        var config = new AmazonS3Config
        {
            ServiceURL = options.ServiceUrl,
            ForcePathStyle = true,
            AuthenticationRegion = options.Region
        };

        _s3Client = new AmazonS3Client(
            string.IsNullOrWhiteSpace(options.KeyId) ? "dev_dummy_key" : options.KeyId,
            string.IsNullOrWhiteSpace(options.ApplicationKey) ? "dev_dummy_app_key" : options.ApplicationKey,
            config);
    }

    public string PublicBucket => _options.PublicBucket;
    public string PrivateBucket => _options.PrivateBucket;

    public async Task<string> UploadPublicAsync(string key, Stream content, string contentType, CancellationToken ct)
    {
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        var request = new PutObjectRequest
        {
            BucketName = _options.PublicBucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(request, ct);
        return GetPublicUrl(_options.PublicBucket, key);
    }

    public async Task<string> UploadPrivateAsync(string key, Stream content, string contentType, CancellationToken ct)
    {
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        var request = new PutObjectRequest
        {
            BucketName = _options.PrivateBucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(request, ct);
        return key;
    }

    public async Task DeleteAsync(string bucket, string key, CancellationToken ct)
    {
        var request = new DeleteObjectRequest
        {
            BucketName = bucket,
            Key = key
        };

        await _s3Client.DeleteObjectAsync(request, ct);
    }

    public string GetPublicUrl(string bucket, string key)
    {
        var cleanServiceUrl = _options.ServiceUrl.TrimEnd('/');
        return $"{cleanServiceUrl}/{bucket}/{key.TrimStart('/')}";
    }

    public string GetPresignedDownloadUrl(string bucket, string key, int expiresInMinutes = 15)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = key,
            Expires = DateTime.UtcNow.AddMinutes(expiresInMinutes),
            Verb = HttpVerb.GET
        };

        return _s3Client.GetPreSignedURL(request);
    }

    public string GetPresignedUploadUrl(string bucket, string key, string contentType, int expiresInMinutes = 10)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = key,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(expiresInMinutes),
            Verb = HttpVerb.PUT
        };

        return _s3Client.GetPreSignedURL(request);
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _s3Client.Dispose();
            _disposed = true;
        }
    }
}
