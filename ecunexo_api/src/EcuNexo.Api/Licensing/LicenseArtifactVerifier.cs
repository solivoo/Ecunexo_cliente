using EcuNexo.Api.Configuration;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Licensing;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Licensing;

public sealed class LicenseArtifactVerifier : ILicenseArtifactVerifier
{
    private readonly ILicenseValidationPepperProvider _pepper;
    private readonly string _publicKeyPem;

    public LicenseArtifactVerifier(
        ILicenseValidationPepperProvider pepper,
        IOptions<LicenseValidationOptions> options,
        IHostEnvironment env)
    {
        _pepper = pepper;
        _publicKeyPem = ResolvePublicKeyPem(options.Value, env);
    }

    public Result<LicenseArtifactPayload> Verify(string activationCode, string licenseArtifactJson)
    {
        if (string.IsNullOrWhiteSpace(_pepper.ValidationPepper))
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error(
                    "license.validation.pepper.missing",
                    "Pepper de validación no configurado.",
                    ErrorType.Unexpected));
        }

        if (string.IsNullOrWhiteSpace(_publicKeyPem))
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error(
                    "license.validation.public_key.missing",
                    "Clave pública de licencias no configurada.",
                    ErrorType.Unexpected));
        }

        var verified = LicenseArtifactCodec.Verify(licenseArtifactJson, _publicKeyPem);
        if (verified.IsFailure)
        {
            return verified;
        }

        var payload = verified.Value!;
        var utcNow = DateTimeOffset.UtcNow;
        if (utcNow >= payload.ExpiresAtUtc)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.expired", "La licencia ha expirado.", ErrorType.Forbidden));
        }

        string validationHash;
        try
        {
            var normalized = LicenseHashing.NormalizeActivationCode(activationCode);
            validationHash = LicenseHashing.ComputeValidationHash(normalized, _pepper.ValidationPepper);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error("license.code.invalid", ex.Message, ErrorType.Validation));
        }

        if (!string.Equals(validationHash, payload.ValidationHash, StringComparison.Ordinal))
        {
            return Result.Failure<LicenseArtifactPayload>(
                new Error(
                    "license.validation_hash.mismatch",
                    "El código no coincide con el paquete de licencia.",
                    ErrorType.Unauthorized));
        }

        return Result.Success(payload);
    }

    private static string ResolvePublicKeyPem(LicenseValidationOptions options, IHostEnvironment env)
    {
        if (!string.IsNullOrWhiteSpace(options.SigningPublicKeyPem))
        {
            return options.SigningPublicKeyPem;
        }

        if (string.IsNullOrWhiteSpace(options.SigningPublicKeyPath))
        {
            return string.Empty;
        }

        var path = options.SigningPublicKeyPath;
        if (!Path.IsPathRooted(path))
        {
            path = Path.Combine(env.ContentRootPath, path);
        }

        return File.Exists(path) ? File.ReadAllText(path) : string.Empty;
    }
}
