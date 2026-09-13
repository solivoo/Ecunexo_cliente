using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace EcuNexo.Business.Tenancy.Certificates;

/// <summary>
/// Cifrado autenticado AES-256-GCM para certificados digitales (.p12) y contraseñas.
/// Utiliza una clave maestra de 256 bits configurada vía SigningCertificate:MasterKey o env var SIGNING_CERTIFICATE_MASTER_KEY.
/// </summary>
public sealed class AesGcmCertificateEncryptionService : ICertificateEncryptionService
{
    private const int KeySizeBytes = 32; // 256 bits
    private const int NonceSizeBytes = 12; // 96 bits
    private const int TagSizeBytes = 16; // 128 bits

    private readonly byte[] _masterKey;

    public AesGcmCertificateEncryptionService(IConfiguration configuration)
    {
        _masterKey = ResolveMasterKey(configuration);
    }

    // Constructor para tests con clave explícita
    public AesGcmCertificateEncryptionService(byte[] masterKey)
    {
        if (masterKey == null || masterKey.Length != KeySizeBytes)
        {
            throw new ArgumentException($"La clave maestra debe tener exactamente {KeySizeBytes} bytes.", nameof(masterKey));
        }

        _masterKey = masterKey.ToArray();
    }

    public EncryptedPayload Encrypt(byte[] plaintext)
    {
        if (plaintext == null || plaintext.Length == 0)
        {
            throw new ArgumentException("El contenido a cifrar no puede estar vacío.", nameof(plaintext));
        }

        var nonce = new byte[NonceSizeBytes];
        RandomNumberGenerator.Fill(nonce);

        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSizeBytes];

        using var aesGcm = new AesGcm(_masterKey, TagSizeBytes);
        aesGcm.Encrypt(nonce, plaintext, ciphertext, tag);

        return new EncryptedPayload(ciphertext, nonce, tag);
    }

    public byte[] Decrypt(byte[] ciphertext, byte[] nonce, byte[] tag)
    {
        if (ciphertext == null || ciphertext.Length == 0)
        {
            throw new ArgumentException("El texto cifrado no puede estar vacío.", nameof(ciphertext));
        }

        if (nonce == null || nonce.Length != NonceSizeBytes)
        {
            throw new ArgumentException($"El nonce debe tener {NonceSizeBytes} bytes.", nameof(nonce));
        }

        if (tag == null || tag.Length != TagSizeBytes)
        {
            throw new ArgumentException($"El tag debe tener {TagSizeBytes} bytes.", nameof(tag));
        }

        var plaintext = new byte[ciphertext.Length];

        using var aesGcm = new AesGcm(_masterKey, TagSizeBytes);
        aesGcm.Decrypt(nonce, ciphertext, tag, plaintext);

        return plaintext;
    }

    private static byte[] ResolveMasterKey(IConfiguration configuration)
    {
        var rawKey = configuration["SigningCertificate:MasterKey"]
            ?? configuration["SIGNING_CERTIFICATE_MASTER_KEY"]
            ?? Environment.GetEnvironmentVariable("SIGNING_CERTIFICATE_MASTER_KEY");

        if (!string.IsNullOrWhiteSpace(rawKey))
        {
            // Puede ser hex de 64 caracteres o Base64 o string directo
            if (rawKey.Length == 64 && IsHexString(rawKey))
            {
                return Convert.FromHexString(rawKey);
            }

            try
            {
                var fromBase64 = Convert.FromBase64String(rawKey);
                if (fromBase64.Length == KeySizeBytes)
                {
                    return fromBase64;
                }
            }
            catch
            {
                // Fallback a SHA256 del string provisto
            }

            return SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
        }

        return SHA256.HashData(Encoding.UTF8.GetBytes("ecunexo-dev-signing-certificate-master-key-32bytes"));
    }

    private static bool IsHexString(string s)
    {
        foreach (var c in s)
        {
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
            {
                return false;
            }
        }
        return true;
    }
}
