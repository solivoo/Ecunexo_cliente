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

    Task<Result<LicenseRemoteEntitlements>> GetEntitlementsAsync(Guid grantId, CancellationToken ct);
}

public sealed record LicenseRemoteStatus(Guid GrantId, bool IsAllowed, string Status, DateTimeOffset ExpiresAtUtc);

/// <summary>Entitlements vigentes en la plataforma para sincronizar en el tenant (cloud).</summary>
public sealed record LicenseRemoteEntitlements(
    Guid GrantId,
    int EntitlementsVersion,
    IReadOnlyList<string> EnabledModuleCodes,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    DateTimeOffset? UpdatedAtUtc);
