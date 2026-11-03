using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Logging;

namespace EcuNexo.Business.Tenancy.Licensing;

public sealed class LicenseComplianceService : ILicenseComplianceService
{
    private static readonly Action<ILogger, Guid, string, Exception?> LogEntitlementsUnavailable =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Warning,
            new EventId(1, "LicenseEntitlementsUnavailable"),
            "No se pudieron sincronizar los entitlements del grant {GrantId}: {Reason}");

    private static readonly Action<ILogger, Guid, int, Exception?> LogEntitlementsSynced =
        LoggerMessage.Define<Guid, int>(
            LogLevel.Information,
            new EventId(2, "LicenseEntitlementsSynced"),
            "Entitlements del grant {GrantId} sincronizados a la versión {Version}.");

    private static readonly Action<ILogger, Guid, string, Exception?> LogCompanySyncSkipped =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Warning,
            new EventId(3, "LicenseCompanyEntitlementsSkipped"),
            "No se pudo aplicar la licencia a la empresa {TenantId}: {Reason}");

    private static readonly Action<ILogger, Guid, string, Exception?> LogTenantReportFailed =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Warning,
            new EventId(4, "LicenseTenantsReportFailed"),
            "No se pudieron reportar las empresas del grant {GrantId}: {Reason}");

    private static readonly Action<ILogger, Guid, Guid, Exception?> LogGrantSuccessorMigrated =
        LoggerMessage.Define<Guid, Guid>(
            LogLevel.Information,
            new EventId(5, "LicenseGrantSuccessorMigrated"),
            "Grant {OldGrantId} migrado al sucesor activo {NewGrantId} tras reemisión/renovación.");

    private readonly ILicenseOnlineValidator _onlineValidator;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<LicenseComplianceService> _logger;
    private readonly IRoleRepository? _roles;
    private readonly IPermissionRepository? _permissions;
    private readonly IRolePermissionRepository? _rolePermissions;
    private readonly DefaultWarehouseProvisioner? _warehouseProvisioner;

    public LicenseComplianceService(
        ILicenseOnlineValidator onlineValidator,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork,
        ILogger<LicenseComplianceService> logger,
        IRoleRepository? roles = null,
        IPermissionRepository? permissions = null,
        IRolePermissionRepository? rolePermissions = null,
        DefaultWarehouseProvisioner? warehouseProvisioner = null)
    {
        _onlineValidator = onlineValidator;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _roles = roles;
        _permissions = permissions;
        _rolePermissions = rolePermissions;
        _warehouseProvisioner = warehouseProvisioner;
    }

    public async Task<Result<Unit>> EnsureCompliantAsync(SubscriptionAccount account, CancellationToken ct)
    {
        var utcNow = DateTimeOffset.UtcNow;
        if (account.IsLicenseExpired(utcNow))
        {
            return Result.Failure<Unit>(
                new Error("license.expired", "La licencia ha expirado.", ErrorType.Forbidden));
        }

        if (!_onlineValidator.IsConfigured)
        {
            account.RecordOnlineValidation(utcNow);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Unit.Value;
        }

        var migratedSuccessor = false;
        if (account.IsOnlineValidationDue(utcNow))
        {
            var remote = await _onlineValidator.ValidateGrantAsync(account.GrantId, ct).ConfigureAwait(false);
            if (remote.IsSuccess)
            {
                var status = remote.Value!;
                if (status.SuccessorGrantId is { } successorId && successorId != Guid.Empty && status.SuccessorExpiresAtUtc is { } successorExpires)
                {
                    migratedSuccessor = ReplaceAccountGrantFromSuccessor(account, status, utcNow);
                }
                else if (!status.IsAllowed)
                {
                    return Result.Failure<Unit>(
                        new Error(
                            "license.revoked",
                            "La licencia fue revocada o ya no está activa en Ecunexo.",
                            ErrorType.Forbidden));
                }

                account.RecordOnlineValidation(utcNow);
            }
            else if (remote.Error is { Type: ErrorType.NotFound })
            {
                return Result.Failure<Unit>(
                    new Error(
                        "license.not_found",
                        "La licencia no está registrada en Ecunexo.",
                        ErrorType.Forbidden));
            }
            else
            {
                return Result.Failure<Unit>(
                    new Error(
                        "license.validation.required",
                        "Debes conectarte a internet para validar la licencia antes de continuar.",
                        ErrorType.Forbidden));
            }
        }

        // Toggles casi en vivo: en cada login se sincronizan entitlements (con throttle propio)
        // sin depender del intervalo de compliance y sin bloquear el login si la plataforma falla.
        var entitlementsSync = await SyncEntitlementsAsync(
                account,
                utcNow,
                force: migratedSuccessor,
                applyFallbackOnRemoteFailure: migratedSuccessor,
                ct)
            .ConfigureAwait(false);
        _ = entitlementsSync;

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Unit.Value;
    }

    public async Task<Result<Unit>> SyncLicenseOnlineAsync(SubscriptionAccount account, CancellationToken ct)
    {
        if (!_onlineValidator.IsConfigured)
        {
            return Result.Failure<Unit>(
                new Error("license.online.not_configured", "La validación en línea no está configurada.", ErrorType.Validation));
        }

        var utcNow = DateTimeOffset.UtcNow;
        var remote = await _onlineValidator.ValidateGrantAsync(account.GrantId, ct).ConfigureAwait(false);
        if (remote.IsFailure)
        {
            return Result.Failure<Unit>(remote.Error!);
        }

        var status = remote.Value!;
        var migratedSuccessor = false;
        if (status.SuccessorGrantId is { } successorId && successorId != Guid.Empty && status.SuccessorExpiresAtUtc is { } successorExpires)
        {
            migratedSuccessor = ReplaceAccountGrantFromSuccessor(account, status, utcNow);
        }
        else if (!status.IsAllowed)
        {
            return Result.Failure<Unit>(
                new Error("license.revoked", "La licencia fue revocada o ya no está activa en Ecunexo.", ErrorType.Forbidden));
        }

        account.RecordOnlineValidation(utcNow);

        // Sincronización forzada e inmediata de módulos y cuotas sin throttle (una sola pasada sobre empresas)
        var entitlementsSync = await SyncEntitlementsAsync(
                account,
                utcNow,
                force: true,
                applyFallbackOnRemoteFailure: migratedSuccessor,
                ct)
            .ConfigureAwait(false);
        if (entitlementsSync.IsFailure)
        {
            return Result.Failure<Unit>(entitlementsSync.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Unit.Value;
    }

    private bool ReplaceAccountGrantFromSuccessor(
        SubscriptionAccount account,
        LicenseRemoteStatus remote,
        DateTimeOffset utcNow)
    {
        var oldGrantId = account.GrantId;
        var hasWarehousing = remote.SuccessorEnabledModuleCodes is null
            || remote.SuccessorEnabledModuleCodes.Contains(TenantModuleCodes.Warehousing, StringComparer.OrdinalIgnoreCase);
        var resolvedMaxWarehouses = hasWarehousing
            ? (remote.SuccessorMaxWarehouses ?? account.ServicePlan.MaxWarehouses)
            : 0;

        var plan = new ServicePlan(
            remote.SuccessorPlanLabel ?? account.ServicePlan.Name,
            remote.SuccessorMaxUsers ?? account.ServicePlan.MaxUsers,
            resolvedMaxWarehouses);

        var replaceResult = account.ReplaceLicenseGrant(
            remote.SuccessorGrantId!.Value,
            plan,
            remote.SuccessorMaxTenants ?? account.SubscriptionMaxTenants,
            remote.SuccessorEnabledModuleCodes ?? account.EnabledModuleCodes,
            remote.SuccessorModuleEntitlements ?? account.ModuleEntitlements,
            remote.SuccessorExpiresAtUtc!.Value,
            remote.SuccessorOnlineValidationIntervalDays ?? account.OnlineValidationIntervalDays,
            utcNow);

        if (replaceResult.IsFailure)
        {
            LogCompanySyncSkipped(_logger, account.Id, replaceResult.Error!.Code, null);
            return false;
        }

        LogGrantSuccessorMigrated(_logger, oldGrantId, account.GrantId, null);
        return true;
    }

    /// <summary>
    /// Aplica los entitlements remotos al titular y a sus empresas. Un fallo de sincronización
    /// en background (force=false) no bloquea el login; con force=true propaga el error.
    /// </summary>
    private async Task<Result<Unit>> SyncEntitlementsAsync(
        SubscriptionAccount account,
        DateTimeOffset utcNow,
        bool force,
        bool applyFallbackOnRemoteFailure,
        CancellationToken ct)
    {
        if (!force && !account.IsEntitlementsSyncDue(utcNow))
        {
            return Unit.Value;
        }

        // El throttle se registra aunque la consulta falle para no golpear la plataforma en cada login.
        account.RecordEntitlementsSync(utcNow);

        var companies = await _tenants
            .ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, ct)
            .ConfigureAwait(false);

        // Reporte best-effort: habilita los overrides por empresa en el panel de licencias.
        var report = await _onlineValidator
            .ReportTenantsAsync(
                account.GrantId,
                companies.Select(c => new LicenseTenantRef(c.Id, c.Name)).ToList(),
                ct)
            .ConfigureAwait(false);
        if (report.IsFailure)
        {
            LogTenantReportFailed(_logger, account.GrantId, report.Error!.Code, null);
        }

        var remote = await _onlineValidator.GetEntitlementsAsync(account.GrantId, ct).ConfigureAwait(false);
        if (remote.IsFailure)
        {
            LogEntitlementsUnavailable(_logger, account.GrantId, remote.Error!.Code, null);
            if (applyFallbackOnRemoteFailure)
            {
                await ApplyLicenseToCompaniesAsync(account, companies, overrides: null, ct).ConfigureAwait(false);
                return Unit.Value;
            }

            return force ? Result.Failure<Unit>(remote.Error!) : Unit.Value;
        }

        var payload = remote.Value!;
        if (!force && payload.EntitlementsVersion <= account.LicenseEntitlementsVersion)
        {
            return Unit.Value;
        }

        var applied = account.ApplyRemoteEntitlements(
            payload.EnabledModuleCodes,
            payload.ModuleEntitlements,
            payload.EntitlementsVersion,
            utcNow,
            force);
        if (applied.IsFailure)
        {
            LogEntitlementsUnavailable(_logger, account.GrantId, applied.Error!.Code, null);
            return force ? Result.Failure<Unit>(applied.Error!) : Unit.Value;
        }

        var overrides = payload.TenantOverrides is { Count: > 0 }
            ? payload.TenantOverrides.ToDictionary(o => o.TenantId)
            : null;

        await ApplyLicenseToCompaniesAsync(account, companies, overrides, ct).ConfigureAwait(false);

        LogEntitlementsSynced(_logger, account.GrantId, payload.EntitlementsVersion, null);
        return Unit.Value;
    }

    private async Task ApplyLicenseToCompaniesAsync(
        SubscriptionAccount account,
        IReadOnlyList<Tenant> companies,
        Dictionary<Guid, LicenseRemoteTenantOverride>? overrides,
        CancellationToken ct)
    {
        var activePermissions = _permissions is not null && companies.Count > 0
            ? await _permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false)
            : null;

        foreach (var company in companies)
        {
            IReadOnlyList<string>? effectiveModules = account.EnabledModuleCodes;
            var effectiveEntitlements = account.ModuleEntitlements;
            if (overrides is not null && overrides.TryGetValue(company.Id, out var tenantOverride))
            {
                effectiveModules = tenantOverride.EnabledModuleCodes;
                effectiveEntitlements = tenantOverride.ModuleEntitlements;
            }

            var companyResult = company.ApplySubscriptionLicense(
                account.ServicePlan,
                account.SubscriptionMaxTenants,
                effectiveModules,
                effectiveEntitlements);
            if (companyResult.IsFailure)
            {
                LogCompanySyncSkipped(_logger, company.Id, companyResult.Error!.Code, null);
                continue;
            }

            if (activePermissions is not null)
            {
                await SyncSystemRolesPermissionsAsync(
                    company,
                    activePermissions,
                    effectiveModules,
                    effectiveEntitlements,
                    ct).ConfigureAwait(false);
            }

            if (_warehouseProvisioner is not null)
            {
                await _warehouseProvisioner.StageDefaultsForTenantAsync(company, ct).ConfigureAwait(false);
            }
        }
    }

    private async Task SyncSystemRolesPermissionsAsync(
        Tenant company,
        IReadOnlyList<Permission> activePermissions,
        IReadOnlyList<string>? enabledModules,
        IReadOnlyList<ModuleEntitlement>? entitlements,
        CancellationToken ct)
    {
        if (_roles is null || _rolePermissions is null)
        {
            return;
        }

        var roles = await _roles.ListActiveByTenantAsync(company.Id, ct).ConfigureAwait(false);
        var activeById = activePermissions.ToDictionary(p => p.Id);

        foreach (var role in roles.Where(r => r.IsSystem))
        {
            var existingIds = await _rolePermissions
                .ListPermissionIdsByRoleAsync(company.Id, role.Id, ct)
                .ConfigureAwait(false);
            var existingSet = new HashSet<Guid>(existingIds);

            foreach (var permission in activePermissions)
            {
                var isAllowed = permission.Status == PermissionStatus.Active
                    && ModulePermissionFilter.IsPermittedForModules(permission.Code, enabledModules, entitlements);

                if (isAllowed && !existingSet.Contains(permission.Id))
                {
                    var link = RolePermission.Link(role.Id, permission.Id);
                    if (link.IsSuccess)
                    {
                        await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
                        existingSet.Add(permission.Id);
                    }
                }
                else if (!isAllowed && existingSet.Contains(permission.Id))
                {
                    await _rolePermissions.RemoveAsync(company.Id, role.Id, permission.Id, ct).ConfigureAwait(false);
                    existingSet.Remove(permission.Id);
                }
            }

            foreach (var existingId in existingSet.ToList())
            {
                if (!activeById.ContainsKey(existingId))
                {
                    await _rolePermissions.RemoveAsync(company.Id, role.Id, existingId, ct).ConfigureAwait(false);
                }
            }
        }
    }
}
