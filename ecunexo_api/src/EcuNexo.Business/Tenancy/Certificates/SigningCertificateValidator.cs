using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Certificates;

public sealed partial class SigningCertificateValidator : ISigningCertificateValidator
{
    public Result<ValidatedCertificateInfo> Validate(byte[] p12Bytes, string password)
    {
        if (p12Bytes == null || p12Bytes.Length == 0)
        {
            return Result.Failure<ValidatedCertificateInfo>(
                new Error("certificate.empty", "El archivo de certificado .p12 está vacío.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return Result.Failure<ValidatedCertificateInfo>(
                new Error("certificate.password_required", "La contraseña del certificado es requerida.", ErrorType.Validation));
        }

        X509Certificate2 cert;
        try
        {
            // EphemeralKeySet asegura que no se escriba en el almacén de claves del sistema operativo
            cert = X509CertificateLoader.LoadPkcs12(
                p12Bytes,
                password,
                X509KeyStorageFlags.EphemeralKeySet | X509KeyStorageFlags.Exportable);
        }
        catch (CryptographicException)
        {
            return Result.Failure<ValidatedCertificateInfo>(
                new Error(
                    "certificate.invalid_password_or_format",
                    "No se pudo abrir el certificado digital. Verifica que la contraseña sea correcta y el archivo corresponda a un formato PKCS#12 (.p12 / .pfx) válido.",
                    ErrorType.Validation));
        }

        using (cert)
        {
            if (!cert.HasPrivateKey)
            {
                return Result.Failure<ValidatedCertificateInfo>(
                    new Error(
                        "certificate.missing_private_key",
                        "El certificado digital provisto no contiene una clave privada. Se requiere un certificado de firma electrónica completo para autorizar ante el SRI.",
                        ErrorType.Validation));
            }

            var now = DateTime.UtcNow;
            if (now > cert.NotAfter.ToUniversalTime())
            {
                return Result.Failure<ValidatedCertificateInfo>(
                    new Error(
                        "certificate.expired",
                        $"El certificado digital ha expirado el {cert.NotAfter:dd/MM/yyyy HH:mm}. No puede utilizarse para firmar comprobantes SRI.",
                        ErrorType.Validation));
            }

            var subject = cert.Subject;
            var issuer = cert.Issuer;
            var validFrom = cert.NotBefore.ToUniversalTime();
            var validTo = cert.NotAfter.ToUniversalTime();
            var serialNumber = cert.SerialNumber;
            var taxId = ExtractTaxIdFromSubject(subject);

            return Result.Success(new ValidatedCertificateInfo(
                Subject: CleanDistinguishedName(subject),
                Issuer: CleanDistinguishedName(issuer),
                ValidFrom: validFrom,
                ValidTo: validTo,
                SubjectTaxId: taxId,
                SerialNumber: serialNumber,
                HasPrivateKey: true));
        }
    }

    public X509Certificate2 LoadEphemeralCertificate(byte[] p12Bytes, string password)
    {
        return X509CertificateLoader.LoadPkcs12(
            p12Bytes,
            password,
            X509KeyStorageFlags.EphemeralKeySet | X509KeyStorageFlags.Exportable);
    }

    private static string CleanDistinguishedName(string dn)
    {
        if (string.IsNullOrWhiteSpace(dn))
        {
            return string.Empty;
        }

        var match = CommonNameRegex().Match(dn);
        if (match.Success)
        {
            return match.Groups[1].Value.Trim();
        }

        return dn;
    }

    private static string? ExtractTaxIdFromSubject(string subject)
    {
        if (string.IsNullOrWhiteSpace(subject))
        {
            return null;
        }

        var rucMatch = TaxIdRegex().Match(subject);
        if (rucMatch.Success)
        {
            return rucMatch.Value;
        }

        return null;
    }

    [GeneratedRegex(@"CN=([^,]+)", RegexOptions.IgnoreCase)]
    private static partial Regex CommonNameRegex();

    [GeneratedRegex(@"\b\d{10}(\d{3})?\b")]
    private static partial Regex TaxIdRegex();
}
