using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Licensing;

/// <summary>
/// Dos dominios de huella: emisión (solo Ecunexo / platform) y validación (despliegue cliente).
/// Mismo algoritmo SHA-256, peppers y prefijos distintos — conocer uno no permite forjar el otro.
/// </summary>
public static class LicenseHashing
{
    private const string IssueDomain = "ecunexo:license:issue:v1";
    private const string ValidateDomain = "ecunexo:license:validate:v1";

    public static string NormalizeActivationCode(string raw) => ActivationCodeHasher.Normalize(raw);

    /// <summary>Huella persistida en <c>licensing_ecunexo.license_grants.code_hash</c> (solo platform).</summary>
    public static string ComputeIssueHash(string normalizedCode, string issuePepper)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(issuePepper);
        return ActivationCodeHasher.ComputeHash($"{IssueDomain}|{normalizedCode}", issuePepper);
    }

    /// <summary>Huella incluida en el artefacto; el tenant la recomputa con <c>ValidationPepper</c>.</summary>
    public static string ComputeValidationHash(string normalizedCode, string validationPepper)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(validationPepper);
        return ActivationCodeHasher.ComputeHash($"{ValidateDomain}|{normalizedCode}", validationPepper);
    }
}
