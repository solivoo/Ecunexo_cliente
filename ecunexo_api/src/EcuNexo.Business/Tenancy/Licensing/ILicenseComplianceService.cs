using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

public interface ILicenseComplianceService
{
    Task<Result<Unit>> EnsureCompliantAsync(SubscriptionAccount account, CancellationToken ct);
}

public interface ILicenseOnlineValidator
{
    bool IsConfigured { get; }

    Task<Result<LicenseRemoteStatus>> ValidateGrantAsync(Guid grantId, CancellationToken ct);

    /// <summary>Reporta a la plataforma las empresas del titular (best-effort) para habilitar overrides por empresa.</summary>
    Task<Result<Unit>> ReportTenantsAsync(
        Guid grantId,
        IReadOnlyList<LicenseTenantRef> tenants,
        CancellationToken ct);

    Task<Result<LicenseRemoteEntitlements>> GetEntitlementsAsync(Guid grantId, CancellationToken ct);
}

public sealed record LicenseRemoteStatus(Guid GrantId, bool IsAllowed, string Status, DateTimeOffset ExpiresAtUtc);

/// <summary>Empresa del titular reportada a la plataforma de licencias.</summary>
public sealed record LicenseTenantRef(Guid TenantId, string Name);

/// <summary>Override de módulos/entitlements administrado por el operador para una empresa.</summary>
public sealed record LicenseRemoteTenantOverride(
    Guid TenantId,
    string TenantName,
    IReadOnlyList<string> EnabledModuleCodes,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    int OverrideVersion);

/// <summary>Entitlements vigentes en la plataforma para sincronizar en el tenant (cloud).</summary>
public sealed record LicenseRemoteEntitlements(
    Guid GrantId,
    int EntitlementsVersion,
    IReadOnlyList<string> EnabledModuleCodes,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    DateTimeOffset? UpdatedAtUtc,
    IReadOnlyList<LicenseRemoteTenantOverride>? TenantOverrides = null);
