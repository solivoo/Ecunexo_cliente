using System.Security.Cryptography;
using System.Text.Json;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Licensing;

public static class LicenseArtifactCodec
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string Sign(LicenseArtifactPayload payload, string privateKeyPem)
    {
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
        var payloadB64 = Base64UrlEncode(payloadBytes);
        var signature = SignPayload(payloadBytes, privateKeyPem);
        var envelope = new SignedLicenseArtifact(SignedLicenseArtifact.CurrentVersion, payloadB64, Base64UrlEncode(signature));
        return JsonSerializer.Serialize(envelope, JsonOptions);
    }

    public static Result<LicenseArtifactPayload> Verify(string artifactJson, string publicKeyPem)
    {
        if (string.IsNullOrWhiteSpace(artifactJson))
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.empty", "El paquete de licencia es obligatorio.", ErrorType.Validation));
        }

        SignedLicenseArtifact envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<SignedLicenseArtifact>(artifactJson, JsonOptions)
                ?? throw new JsonException("Envelope nulo.");
        }
        catch (Exception)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.parse", "Formato de licencia inválido.", ErrorType.Validation));
        }

        if (envelope.Version != SignedLicenseArtifact.CurrentVersion)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.version", "Versión de licencia no soportada.", ErrorType.Validation));
        }

        byte[] payloadBytes;
        byte[] signature;
        try
        {
            payloadBytes = Base64UrlDecode(envelope.PayloadBase64Url);
            signature = Base64UrlDecode(envelope.SignatureBase64Url);
        }
        catch (Exception)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.encoding", "Codificación del paquete inválida.", ErrorType.Validation));
        }

        if (!VerifySignature(payloadBytes, signature, publicKeyPem))
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error(
                    "license.artifact.signature",
                    "La firma de la licencia no es válida.",
                    ErrorType.Unauthorized));
        }

        LicenseArtifactPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<LicenseArtifactPayload>(payloadBytes, JsonOptions);
        }
        catch (Exception)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.payload", "Contenido de licencia inválido.", ErrorType.Validation));
        }

        if (payload is null || payload.GrantId == Guid.Empty)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.artifact.grant", "Identificador de licencia inválido.", ErrorType.Validation));
        }

        return Result.Success(payload);
    }

    private static byte[] SignPayload(byte[] payloadBytes, string privateKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        return rsa.SignData(payloadBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
    }

    private static bool VerifySignature(byte[] payloadBytes, byte[] signature, string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        return rsa.VerifyData(payloadBytes, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }

        return Convert.FromBase64String(padded);
    }
}
