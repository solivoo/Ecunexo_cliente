using System.Security.Cryptography.X509Certificates;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Certificates;

public sealed record ValidatedCertificateInfo(
    string Subject,
    string Issuer,
    DateTime ValidFrom,
    DateTime ValidTo,
    string? SubjectTaxId,
    string? SerialNumber,
    bool HasPrivateKey);

public interface ISigningCertificateValidator
{
    Result<ValidatedCertificateInfo> Validate(byte[] p12Bytes, string password);
    X509Certificate2 LoadEphemeralCertificate(byte[] p12Bytes, string password);
}
