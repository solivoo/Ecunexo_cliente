using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Licensing;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ApplySubscriptionLicenseUpgrade;

public sealed class ApplySubscriptionLicenseUpgradeHandler
    : ICommandHandler<ApplySubscriptionLicenseUpgradeCommand, ApplySubscriptionLicenseUpgradeResponse>
{
    private readonly IValidator<ApplySubscriptionLicenseUpgradeCommand> _validator;
    private readonly ILicenseArtifactVerifier _artifactVerifier;
    private readonly ILicenseRedemptionRepository _redemptions;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;

    public ApplySubscriptionLicenseUpgradeHandler(
        IValidator<ApplySubscriptionLicenseUpgradeCommand> validator,
        ILicenseArtifactVerifier artifactVerifier,
        ILicenseRedemptionRepository redemptions,
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _artifactVerifier = artifactVerifier;
        _redemptions = redemptions;
        _accounts = accounts;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ApplySubscriptionLicenseUpgradeResponse>> Handle(
        ApplySubscriptionLicenseUpgradeCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(
                new Error("license.upgrade.validation", message, ErrorType.Validation));
        }

        var verified = _artifactVerifier.Verify(command.ActivationCode, command.LicenseArtifact);
        if (verified.IsFailure)
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(verified.Error!);
        }

        var payload = verified.Value!;
        var account = await _accounts.GetByIdForUpdateAsync(command.SubscriptionAccountId, ct)
            .ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        if (!BelongsToAccount(account, payload))
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(
                new Error(
                    "license.upgrade.mismatch",
                    "Este código no corresponde a tu organización.",
                    ErrorType.Forbidden));
        }

        var existing = await _redemptions.GetByIdAsync(payload.GrantId, ct).ConfigureAwait(false);
        if (existing is not null)
        {
            if (existing.SubscriptionAccountId != account.Id)
            {
                return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(
                    new Error(
                        "license.upgrade.redeemed",
                        "Este código ya fue canjeado en otra organización.",
                        ErrorType.Conflict));
            }

            return ToResponse(account);
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(payload.PlanLabel, payload.MaxUsers, payload.MaxWarehouses);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(
                new Error("license.upgrade.plan.invalid", ex.Message, ErrorType.Validation));
        }

        var utcNow = DateTimeOffset.UtcNow;
        var replaced = account.ReplaceLicenseGrant(
            payload.GrantId,
            plan,
            payload.MaxTenants,
            payload.EnabledModuleCodes,
            payload.ModuleEntitlements,
            payload.ExpiresAtUtc,
            payload.OnlineValidationIntervalDays,
            utcNow);
        if (replaced.IsFailure)
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(replaced.Error!);
        }

        var companies = await _tenants
            .ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        foreach (var company in companies)
        {
            var applied = company.ApplySubscriptionLicense(
                plan,
                payload.MaxTenants,
                payload.EnabledModuleCodes,
                payload.ModuleEntitlements);
            if (applied.IsFailure)
            {
                return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(applied.Error!);
            }
        }

        var redemption = LicenseRedemption.Create(payload.GrantId, account.Id, utcNow);
        if (redemption.IsFailure)
        {
            return Result.Failure<ApplySubscriptionLicenseUpgradeResponse>(redemption.Error!);
        }

        await _redemptions.AddAsync(redemption.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return ToResponse(account);
    }

    private static bool BelongsToAccount(SubscriptionAccount account, LicenseArtifactPayload payload)
    {
        if (payload.SupersedesGrantId is { } previous && previous == account.GrantId)
        {
            return true;
        }

        if (payload.GrantId == account.GrantId)
        {
            return true;
        }

        return string.Equals(
            payload.Provisioning.OwnerEmail.Trim(),
            account.Email,
            StringComparison.OrdinalIgnoreCase);
    }

    private static ApplySubscriptionLicenseUpgradeResponse ToResponse(SubscriptionAccount account) =>
        new(
            account.Id,
            account.ServicePlan.Name,
            account.ServicePlan.MaxUsers,
            account.ServicePlan.MaxWarehouses,
            account.SubscriptionMaxTenants,
            account.EnabledModuleCodes);
}
