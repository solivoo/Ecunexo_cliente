using System.Security.Cryptography;
using System.Text;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Huella irreversible del código tal como lo escribe el cliente (pepper + normalización).
/// No sustituye almacenar secretos en claro: solo compara huellas en servidor.
/// </summary>
public static class ActivationCodeHasher
{
    public static string Normalize(string raw)
    {
        ArgumentNullException.ThrowIfNull(raw);
        return raw.Trim().ToUpperInvariant();
    }

    public static string ComputeHash(string normalizedCode, string pepper)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pepper);
        ArgumentException.ThrowIfNullOrWhiteSpace(normalizedCode);

        var payload = Encoding.UTF8.GetBytes(pepper + "|" + normalizedCode);
        var hash = SHA256.HashData(payload);
        return Convert.ToHexString(hash);
    }
}
