using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Certificado digital de firma electrónica (.p12 / .pfx) del tenant,
/// almacenado con cifrado autenticado AES-256-GCM para emisión ante el SRI.
/// </summary>
public sealed class TenantSigningCertificate : AggregateRoot<Guid>, IAuditable
{
    public const int SubjectMaxLength = 500;
    public const int IssuerMaxLength = 300;
    public const int SerialNumberMaxLength = 120;
    public const int SubjectTaxIdMaxLength = 20;

    private TenantSigningCertificate()
    {
        Subject = string.Empty;
        Issuer = string.Empty;
        EncryptedData = [];
        EncryptedPassword = [];
        Nonce = [];
        Tag = [];
    }

    public Guid TenantId { get; private set; }

    /// <summary>Bytes del archivo .p12 cifrados con AES-256-GCM.</summary>
    public byte[] EncryptedData { get; private set; }

    /// <summary>Contraseña del certificado cifrada con AES-256-GCM.</summary>
    public byte[] EncryptedPassword { get; private set; }

    /// <summary>Vector de inicialización / Nonce (12 bytes) para AES-GCM.</summary>
    public byte[] Nonce { get; private set; }

    /// <summary>Tag de autenticación (16 bytes) para AES-GCM.</summary>
    public byte[] Tag { get; private set; }

    /// <summary>Sujeto/titular del certificado (ej: CN=JUAN PEREZ, O=BANCO CENTRAL...).</summary>
    public string Subject { get; private set; }

    /// <summary>RUC o Cédula extraído del Subject si está presente en el certificado.</summary>
    public string? SubjectTaxId { get; private set; }

    /// <summary>Entidad de certificación emisora (Security Data, BCE, ANFAC, etc.).</summary>
    public string Issuer { get; private set; }

    /// <summary>Fecha de inicio de vigencia.</summary>
    public DateTime ValidFrom { get; private set; }

    /// <summary>Fecha de expiración / caducidad.</summary>
    public DateTime ValidTo { get; private set; }

    /// <summary>Número de serie del certificado.</summary>
    public string? SerialNumber { get; private set; }

    /// <summary>Nombre del archivo original subido (referencial).</summary>
    public string? OriginalFileName { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }

    public bool IsExpired => DateTime.UtcNow > ValidTo;

    public int DaysRemaining
    {
        get
        {
            var remaining = (ValidTo - DateTime.UtcNow).TotalDays;
            return remaining > 0 ? (int)Math.Floor(remaining) : 0;
        }
    }

    public static TenantSigningCertificate Create(
        Guid tenantId,
        byte[] encryptedData,
        byte[] encryptedPassword,
        byte[] nonce,
        byte[] tag,
        string subject,
        string issuer,
        DateTime validFrom,
        DateTime validTo,
        string? subjectTaxId = null,
        string? serialNumber = null,
        string? originalFileName = null)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("El tenantId es obligatorio.", nameof(tenantId));
        }

        if (encryptedData == null || encryptedData.Length == 0)
        {
            throw new ArgumentException("Los datos cifrados del certificado son requeridos.", nameof(encryptedData));
        }

        if (encryptedPassword == null || encryptedPassword.Length == 0)
        {
            throw new ArgumentException("La contraseña cifrada es requerida.", nameof(encryptedPassword));
        }

        if (nonce == null || nonce.Length != 12)
        {
            throw new ArgumentException("El nonce de cifrado debe tener exactamente 12 bytes.", nameof(nonce));
        }

        if (tag == null || tag.Length != 16)
        {
            throw new ArgumentException("El tag de autenticación debe tener exactamente 16 bytes.", nameof(tag));
        }

        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new ArgumentException("El sujeto del certificado es obligatorio.", nameof(subject));
        }

        if (string.IsNullOrWhiteSpace(issuer))
        {
            throw new ArgumentException("El emisor del certificado es obligatorio.", nameof(issuer));
        }

        if (validTo <= validFrom)
        {
            throw new ArgumentException("La fecha de vencimiento debe ser posterior a la fecha de emisión.", nameof(validTo));
        }

        return new TenantSigningCertificate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EncryptedData = encryptedData,
            EncryptedPassword = encryptedPassword,
            Nonce = nonce,
            Tag = tag,
            Subject = subject.Trim(),
            SubjectTaxId = subjectTaxId?.Trim(),
            Issuer = issuer.Trim(),
            ValidFrom = validFrom,
            ValidTo = validTo,
            SerialNumber = serialNumber?.Trim(),
            OriginalFileName = originalFileName?.Trim(),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public void Update(
        byte[] encryptedData,
        byte[] encryptedPassword,
        byte[] nonce,
        byte[] tag,
        string subject,
        string issuer,
        DateTime validFrom,
        DateTime validTo,
        string? subjectTaxId = null,
        string? serialNumber = null,
        string? originalFileName = null)
    {
        if (encryptedData == null || encryptedData.Length == 0)
        {
            throw new ArgumentException("Los datos cifrados del certificado son requeridos.", nameof(encryptedData));
        }

        if (encryptedPassword == null || encryptedPassword.Length == 0)
        {
            throw new ArgumentException("La contraseña cifrada es requerida.", nameof(encryptedPassword));
        }

        if (nonce == null || nonce.Length != 12)
        {
            throw new ArgumentException("El nonce de cifrado debe tener exactamente 12 bytes.", nameof(nonce));
        }

        if (tag == null || tag.Length != 16)
        {
            throw new ArgumentException("El tag de autenticación debe tener exactamente 16 bytes.", nameof(tag));
        }

        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new ArgumentException("El sujeto del certificado es obligatorio.", nameof(subject));
        }

        if (string.IsNullOrWhiteSpace(issuer))
        {
            throw new ArgumentException("El emisor del certificado es obligatorio.", nameof(issuer));
        }

        if (validTo <= validFrom)
        {
            throw new ArgumentException("La fecha de vencimiento debe ser posterior a la fecha de emisión.", nameof(validTo));
        }

        EncryptedData = encryptedData;
        EncryptedPassword = encryptedPassword;
        Nonce = nonce;
        Tag = tag;
        Subject = subject.Trim();
        SubjectTaxId = subjectTaxId?.Trim();
        Issuer = issuer.Trim();
        ValidFrom = validFrom;
        ValidTo = validTo;
        SerialNumber = serialNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(originalFileName))
        {
            OriginalFileName = originalFileName.Trim();
        }

        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
