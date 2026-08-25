namespace EcuNexo.Core.Licensing;

/// <summary>Contenido firmado del paquete de licencia (v1/v2).</summary>
public sealed record LicenseArtifactPayload(
    Guid GrantId,
    string ValidationHash,
    DateTimeOffset ExpiresAtUtc,
    string PlanLabel,
    int MaxTenants,
    int MaxUsers,
    int MaxWarehouses,
    IReadOnlyList<string> EnabledModuleCodes,
    IReadOnlyList<Tenancy.ModuleEntitlement>? ModuleEntitlements,
    LicenseArtifactProvisioning Provisioning,
    Guid? SupersedesGrantId = null,
    int OnlineValidationIntervalDays = LicenseValidationPolicy.DefaultIntervalDays);
