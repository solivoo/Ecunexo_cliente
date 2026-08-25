using EcuNexo.Core.Common;
using EcuNexo.Core.Licensing;

namespace EcuNexo.Business.Tenancy.Licensing;

public interface ILicenseArtifactVerifier
{
    /// <summary>Verifica firma RSA, hash de validación y expiración del artefacto.</summary>
    Result<LicenseArtifactPayload> Verify(string activationCode, string licenseArtifactJson);
}
