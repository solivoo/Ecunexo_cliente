using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.ActivateLicense;

/// <summary>
/// Canje local: código en claro + paquete firmado por Ecunexo. Provisiona en <c>ecunexo</c> sin BD licensing.
/// </summary>
public sealed record ActivateLicenseCommand(
    string ActivationCode,
    string LicenseArtifact) : ICommand<ActivateLicenseResponse>;

public sealed record ActivateLicenseResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    Guid UserId,
    Guid? TenantId,
    bool IsSubscriptionHolder);
