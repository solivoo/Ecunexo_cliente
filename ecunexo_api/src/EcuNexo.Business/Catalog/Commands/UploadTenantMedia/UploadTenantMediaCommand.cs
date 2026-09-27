using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Catalog.ValueObjects;

namespace EcuNexo.Business.Catalog.Commands.UploadTenantMedia;

/// <summary>
/// Sube una imagen optimizada al almacenamiento del tenant sin asociarla a la galería de un ítem.
/// Se usa para atributos de tipo fotos (referencias, certificados, etc.).
/// </summary>
public sealed record UploadTenantMediaCommand(
    Guid TenantId,
    Stream FileStream,
    string FileName,
    string ContentType,
    Guid? UserId = null) : ICommand<TenantMediaResponse>;

public sealed record TenantMediaResponse(
    string StorageKey,
    string ThumbUrl,
    string MediumUrl,
    string LargeUrl,
    int Width,
    int Height,
    long FileSizeBytes,
    string ContentType = ImageOptimizationPolicy.CanonicalMimeType);
