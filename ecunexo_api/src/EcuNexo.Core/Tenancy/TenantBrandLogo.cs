using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>Logo de marca del tenant (bytes comprimidos + nombre/extensión originales).</summary>
public sealed class TenantBrandLogo : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int FileNameMaxLength = 200;
    public const int ExtensionMaxLength = 12;
    public const int ContentTypeMaxLength = 80;
    public const int MaxBytes = 256_000;
    public const int MaxPerTenant = 12;

    private TenantBrandLogo()
    {
        OriginalFileName = string.Empty;
        Extension = string.Empty;
        ContentType = string.Empty;
        ImageBytes = [];
    }

    public Guid TenantId { get; private set; }

    /// <summary>Nombre del archivo que subió el usuario (sin ruta).</summary>
    public string OriginalFileName { get; private set; }

    /// <summary>Extensión almacenada, sin punto (p. ej. webp, png, svg).</summary>
    public string Extension { get; private set; }

    public string ContentType { get; private set; }

    public int ByteSize { get; private set; }

    public byte[] ImageBytes { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<TenantBrandLogo> Create(
        Guid id,
        Guid tenantId,
        string originalFileName,
        string extension,
        string contentType,
        byte[] imageBytes)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<TenantBrandLogo>(
                new Error("brand_logo.ids.invalid", "El identificador del logo no es válido.", ErrorType.Validation));
        }

        var name = Path.GetFileName(originalFileName.Trim());
        if (string.IsNullOrWhiteSpace(name) || name.Length > FileNameMaxLength)
        {
            return Result.Failure<TenantBrandLogo>(
                new Error(
                    "brand_logo.file_name.length",
                    $"El nombre del archivo no puede superar {FileNameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var ext = extension.Trim().TrimStart('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(ext) || ext.Length > ExtensionMaxLength)
        {
            return Result.Failure<TenantBrandLogo>(
                new Error("brand_logo.extension.invalid", "La extensión del logo no es válida.", ErrorType.Validation));
        }

        var type = contentType.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(type) || type.Length > ContentTypeMaxLength)
        {
            return Result.Failure<TenantBrandLogo>(
                new Error("brand_logo.content_type.invalid", "El tipo de imagen no es válido.", ErrorType.Validation));
        }

        if (imageBytes.Length is 0 or > MaxBytes)
        {
            return Result.Failure<TenantBrandLogo>(
                new Error(
                    "brand_logo.size",
                    $"El logo no puede superar {MaxBytes / 1024} KB. Comprime la imagen e inténtalo de nuevo.",
                    ErrorType.Validation));
        }

        return new TenantBrandLogo
        {
            Id = id,
            TenantId = tenantId,
            OriginalFileName = name,
            Extension = ext,
            ContentType = type,
            ByteSize = imageBytes.Length,
            ImageBytes = imageBytes,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}
