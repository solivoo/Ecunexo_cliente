using System.Security.Cryptography;
using System.Text;

namespace EcuNexo.Business.Identity.ApiKeys;

/// <summary>
/// Generación, parseo de prefijo y verificación en tiempo constante de llaves M2M (<c>ecx_live_&lt;prefix8&gt;_&lt;secret48&gt;</c>).
/// </summary>
public static class TenantApiKeyCrypto
{
    public const string TokenHeaderPrefix = "ecx_live_";
    private const int PrefixHexChars = 8; // 4 bytes
    private const int SecretHexChars = 48; // 24 bytes (192 bits de entropía)

    public static (string PlainTextKey, string KeyPrefix, string KeyHash) GenerateKey()
    {
        Span<byte> prefixBytes = stackalloc byte[PrefixHexChars / 2];
        Span<byte> secretBytes = stackalloc byte[SecretHexChars / 2];
        RandomNumberGenerator.Fill(prefixBytes);
        RandomNumberGenerator.Fill(secretBytes);

        var prefixPart = Convert.ToHexStringLower(prefixBytes);
        var secretPart = Convert.ToHexStringLower(secretBytes);

        var keyPrefix = $"{TokenHeaderPrefix}{prefixPart}";
        var plainTextKey = $"{keyPrefix}_{secretPart}";
        var keyHash = ComputeSha256Hex(plainTextKey);

        return (plainTextKey, keyPrefix, keyHash);
    }

    public static bool TryExtractPrefix(string? candidateKey, out string keyPrefix, out string trimmedKey)
    {
        keyPrefix = string.Empty;
        trimmedKey = string.Empty;

        if (string.IsNullOrWhiteSpace(candidateKey))
        {
            return false;
        }

        var trimmed = candidateKey.Trim();
        var expectedPrefixLen = TokenHeaderPrefix.Length + PrefixHexChars;
        if (!trimmed.StartsWith(TokenHeaderPrefix, StringComparison.Ordinal)
            || trimmed.Length <= expectedPrefixLen + 1
            || trimmed[expectedPrefixLen] != '_')
        {
            return false;
        }

        keyPrefix = trimmed[..expectedPrefixLen];
        trimmedKey = trimmed;
        return true;
    }

    public static string ComputeSha256Hex(string plainTextKey)
    {
        var bytes = Encoding.UTF8.GetBytes(plainTextKey);
        Span<byte> hash = stackalloc byte[32];
        SHA256.HashData(bytes, hash);
        return Convert.ToHexStringLower(hash);
    }

    public static bool VerifyFixedTime(string candidatePlainTextKey, string expectedHexHash)
    {
        if (string.IsNullOrWhiteSpace(candidatePlainTextKey)
            || string.IsNullOrWhiteSpace(expectedHexHash)
            || expectedHexHash.Length != 64)
        {
            return false;
        }

        var candidateHex = ComputeSha256Hex(candidatePlainTextKey);
        var candidateBytes = Encoding.ASCII.GetBytes(candidateHex);
        var expectedBytes = Encoding.ASCII.GetBytes(expectedHexHash.ToLowerInvariant());

        return CryptographicOperations.FixedTimeEquals(candidateBytes, expectedBytes);
    }
}
