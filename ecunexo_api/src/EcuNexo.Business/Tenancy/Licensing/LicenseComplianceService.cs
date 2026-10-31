using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
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

    public LicenseComplianceService(
        ILicenseOnlineValidator onlineValidator,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork,
        ILogger<LicenseComplianceService> logger)
    {
        _onlineValidator = onlineValidator;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
        _logger = logger;
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

        if (account.IsOnlineValidationDue(utcNow))
        {
            var remote = await _onlineValidator.ValidateGrantAsync(account.GrantId, ct).ConfigureAwait(false);
            if (remote.IsSuccess)
            {
                var status = remote.Value!;
                if (status.SuccessorGrantId is { } successorId && successorId != Guid.Empty && status.SuccessorExpiresAtUtc is { } successorExpires)
                {
                    await ApplySuccessorGrantAsync(account, status, utcNow, ct).ConfigureAwait(false);
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
        await SyncEntitlementsAsync(account, utcNow, force: false, ct).ConfigureAwait(false);

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
        if (status.SuccessorGrantId is { } successorId && successorId != Guid.Empty && status.SuccessorExpiresAtUtc is { } successorExpires)
        {
            await ApplySuccessorGrantAsync(account, status, utcNow, ct).ConfigureAwait(false);
        }
        else if (!status.IsAllowed)
        {
            return Result.Failure<Unit>(
                new Error("license.revoked", "La licencia fue revocada o ya no está activa en Ecunexo.", ErrorType.Forbidden));
        }

        account.RecordOnlineValidation(utcNow);

        // Sincronización forzada e inmediata de módulos y cuotas sin throttle
        await SyncEntitlementsAsync(account, utcNow, force: true, ct).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Unit.Value;
    }

    private async Task ApplySuccessorGrantAsync(
        SubscriptionAccount account,
        LicenseRemoteStatus remote,
        DateTimeOffset utcNow,
        CancellationToken ct)
    {
        var oldGrantId = account.GrantId;
        var plan = new ServicePlan(
            remote.SuccessorPlanLabel ?? account.ServicePlan.Name,
            remote.SuccessorMaxUsers ?? account.ServicePlan.MaxUsers,
            remote.SuccessorMaxWarehouses ?? account.ServicePlan.MaxWarehouses);

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
            return;
        }

        var companies = await _tenants
            .ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, ct)
            .ConfigureAwait(false);

        foreach (var company in companies)
        {
            var companyResult = company.ApplySubscriptionLicense(
                account.ServicePlan,
                account.SubscriptionMaxTenants,
                account.EnabledModuleCodes,
                account.ModuleEntitlements);
            if (companyResult.IsFailure)
            {
                LogCompanySyncSkipped(_logger, company.Id, companyResult.Error!.Code, null);
            }
        }

        LogGrantSuccessorMigrated(_logger, oldGrantId, account.GrantId, null);
    }

    /// <summary>
    /// Aplica los entitlements remotos al titular y a sus empresas. Un fallo de sincronización
    /// no bloquea el login (se conserva la última configuración válida).
    /// </summary>
    private async Task SyncEntitlementsAsync(
        SubscriptionAccount account,
        DateTimeOffset utcNow,
        bool force,
        CancellationToken ct)
    {
        if (!force && !account.IsEntitlementsSyncDue(utcNow))
        {
            return;
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
            return;
        }

        var payload = remote.Value!;
        if (!force && payload.EntitlementsVersion <= account.LicenseEntitlementsVersion)
        {
            return;
        }

        var applied = account.ApplyRemoteEntitlements(
            payload.EnabledModuleCodes,
            payload.ModuleEntitlements,
            payload.EntitlementsVersion,
            utcNow);
        if (applied.IsFailure)
        {
            LogEntitlementsUnavailable(_logger, account.GrantId, applied.Error!.Code, null);
            return;
        }

        var overrides = payload.TenantOverrides is { Count: > 0 }
            ? payload.TenantOverrides.ToDictionary(o => o.TenantId)
            : null;

        foreach (var company in companies)
        {
            var effectiveModules = payload.EnabledModuleCodes;
            var effectiveEntitlements = payload.ModuleEntitlements;
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
            }
        }

        LogEntitlementsSynced(_logger, account.GrantId, payload.EntitlementsVersion, null);
    }
}
