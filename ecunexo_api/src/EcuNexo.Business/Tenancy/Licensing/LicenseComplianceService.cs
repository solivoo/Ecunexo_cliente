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

        if (!account.IsOnlineValidationDue(utcNow))
        {
            return Unit.Value;
        }

        if (!_onlineValidator.IsConfigured)
        {
            account.RecordOnlineValidation(utcNow);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Unit.Value;
        }

        var remote = await _onlineValidator.ValidateGrantAsync(account.GrantId, ct).ConfigureAwait(false);
        if (remote.IsSuccess)
        {
            if (!remote.Value!.IsAllowed)
            {
                return Result.Failure<Unit>(
                    new Error(
                        "license.revoked",
                        "La licencia fue revocada o ya no está activa en Ecunexo.",
                        ErrorType.Forbidden));
            }

            await SyncEntitlementsAsync(account, utcNow, ct).ConfigureAwait(false);
            account.RecordOnlineValidation(utcNow);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Unit.Value;
        }

        if (remote.Error is { Type: ErrorType.NotFound })
        {
            return Result.Failure<Unit>(
                new Error(
                    "license.not_found",
                    "La licencia no está registrada en Ecunexo.",
                    ErrorType.Forbidden));
        }

        return Result.Failure<Unit>(
            new Error(
                "license.validation.required",
                "Debes conectarte a internet para validar la licencia antes de continuar.",
                ErrorType.Forbidden));
    }

    /// <summary>
    /// Aplica los entitlements remotos al titular y a sus empresas. Un fallo de sincronización
    /// no bloquea el login (se conserva la última configuración válida).
    /// </summary>
    private async Task SyncEntitlementsAsync(
        SubscriptionAccount account,
        DateTimeOffset utcNow,
        CancellationToken ct)
    {
        var remote = await _onlineValidator.GetEntitlementsAsync(account.GrantId, ct).ConfigureAwait(false);
        if (remote.IsFailure)
        {
            LogEntitlementsUnavailable(_logger, account.GrantId, remote.Error!.Code, null);
            return;
        }

        var payload = remote.Value!;
        if (payload.EntitlementsVersion <= account.LicenseEntitlementsVersion)
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

        var companies = await _tenants
            .ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        foreach (var company in companies)
        {
            var companyResult = company.ApplySubscriptionLicense(
                account.ServicePlan,
                account.SubscriptionMaxTenants,
                payload.EnabledModuleCodes,
                payload.ModuleEntitlements);
            if (companyResult.IsFailure)
            {
                LogCompanySyncSkipped(_logger, company.Id, companyResult.Error!.Code, null);
            }
        }

        LogEntitlementsSynced(_logger, account.GrantId, payload.EntitlementsVersion, null);
    }
}
