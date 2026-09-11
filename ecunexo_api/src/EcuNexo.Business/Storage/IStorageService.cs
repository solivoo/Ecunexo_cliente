namespace EcuNexo.Business.Storage;

/// <summary>
/// Contrato unificado de almacenamiento compatible con S3 / Backblaze B2.
/// </summary>
public interface IStorageService
{
    string PublicBucket { get; }
    string PrivateBucket { get; }

    /// <summary>
    /// Sube un archivo al bucket público y retorna su URL pública accesible por CDN/navegador.
    /// </summary>
    Task<string> UploadPublicAsync(string key, Stream content, string contentType, CancellationToken ct);

    /// <summary>
    /// Sube un archivo al bucket privado.
    /// </summary>
    Task<string> UploadPrivateAsync(string key, Stream content, string contentType, CancellationToken ct);

    /// <summary>
    /// Elimina un objeto de un bucket determinado.
    /// </summary>
    Task DeleteAsync(string bucket, string key, CancellationToken ct);

    /// <summary>
    /// Genera la URL pública directa para un objeto en un bucket público.
    /// </summary>
    string GetPublicUrl(string bucket, string key);

    /// <summary>
    /// Genera una URL prefirmada de descarga para un objeto en bucket privado.
    /// </summary>
    string GetPresignedDownloadUrl(string bucket, string key, int expiresInMinutes = 15);

    /// <summary>
    /// Genera una URL prefirmada para subida directa desde el cliente.
    /// </summary>
    string GetPresignedUploadUrl(string bucket, string key, string contentType, int expiresInMinutes = 10);
}
