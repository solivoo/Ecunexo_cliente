using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

public sealed class LicenseComplianceService : ILicenseComplianceService
{
    private readonly ILicenseOnlineValidator _onlineValidator;
    private readonly IUnitOfWork _unitOfWork;

    public LicenseComplianceService(ILicenseOnlineValidator onlineValidator, IUnitOfWork unitOfWork)
    {
        _onlineValidator = onlineValidator;
        _unitOfWork = unitOfWork;
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
}
