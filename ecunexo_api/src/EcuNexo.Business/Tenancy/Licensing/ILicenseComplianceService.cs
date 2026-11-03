using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

public interface ILicenseComplianceService
{
    Task<Result<Unit>> EnsureCompliantAsync(SubscriptionAccount account, CancellationToken ct);

    /// <summary>Sincroniza forzosamente la licencia en línea: aplica reemisiones/renovaciones o módulos actualizados.</summary>
    Task<Result<Unit>> SyncLicenseOnlineAsync(SubscriptionAccount account, CancellationToken ct);
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

    /// <summary>Autentica y obtiene los datos de aprovisionamiento para una suscripción emitida en la plataforma central.</summary>
    Task<Result<LicenseRemoteCloudBootstrap>> BootstrapCloudSubscriptionAsync(
        string email,
        string password,
        CancellationToken ct);
}

public sealed record LicenseRemoteCloudBootstrap(
    Guid GrantId,
    Guid? SupersedesGrantId,
    string PlanCode,
    string PlanLabel,
    int MaxTenants,
    int MaxUsers,
    int MaxWarehouses,
    IReadOnlyList<string> EnabledModuleCodes,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    DateTimeOffset ExpiresAtUtc,
    int OnlineValidationIntervalDays,
    string DeploymentMode,
    string OwnerEmail,
    string OwnerName,
    string? OwnerDepartment,
    string? OwnerPhone,
    string? OwnerJobTitle);

public sealed record LicenseRemoteStatus(
    Guid GrantId,
    bool IsAllowed,
    string Status,
    DateTimeOffset ExpiresAtUtc,
    Guid? SuccessorGrantId = null,
    string? SuccessorStatus = null,
    DateTimeOffset? SuccessorExpiresAtUtc = null,
    string? SuccessorPlanCode = null,
    string? SuccessorPlanLabel = null,
    int? SuccessorMaxTenants = null,
    int? SuccessorMaxUsers = null,
    int? SuccessorMaxWarehouses = null,
    int? SuccessorOnlineValidationIntervalDays = null,
    IReadOnlyList<string>? SuccessorEnabledModuleCodes = null,
    IReadOnlyList<ModuleEntitlement>? SuccessorModuleEntitlements = null,
    int? EntitlementsVersion = null,
    IReadOnlyList<string>? EnabledModuleCodes = null,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements = null,
    int? MaxTenants = null,
    int? MaxUsers = null,
    int? MaxWarehouses = null,
    string? PlanCode = null,
    string? PlanLabel = null,
    int? OnlineValidationIntervalDays = null);

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
