using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Licensing;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.ActivateLicense;

/// <summary>
/// Canje offline: valida paquete firmado + hash de validación; crea un titular por grant (sin tenant).
/// Varias organizaciones pueden coexistir en el mismo despliegue; el correo del titular sigue siendo único.
/// </summary>
public sealed class ActivateLicenseHandler : ICommandHandler<ActivateLicenseCommand, ActivateLicenseResponse>
{
    private readonly IValidator<ActivateLicenseCommand> _validator;
    private readonly ILicenseArtifactVerifier _artifactVerifier;
    private readonly ILicenseRedemptionRepository _redemptions;
    private readonly ISubscriptionAccountRepository _subscriptionAccounts;
    private readonly ITenantRepository _tenants;
    private readonly IRoleRepository _roles;
    private readonly IPermissionRepository _permissions;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtAccessTokenFactory _tokens;

    public ActivateLicenseHandler(
        IValidator<ActivateLicenseCommand> validator,
        ILicenseArtifactVerifier artifactVerifier,
        ILicenseRedemptionRepository redemptions,
        ISubscriptionAccountRepository subscriptionAccounts,
        ITenantRepository tenants,
        IRoleRepository roles,
        IPermissionRepository permissions,
        IRolePermissionRepository rolePermissions,
        DefaultWarehouseProvisioner warehouseProvisioner,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IJwtAccessTokenFactory tokens)
    {
        _validator = validator;
        _artifactVerifier = artifactVerifier;
        _redemptions = redemptions;
        _subscriptionAccounts = subscriptionAccounts;
        _tenants = tenants;
        _roles = roles;
        _permissions = permissions;
        _rolePermissions = rolePermissions;
        _warehouseProvisioner = warehouseProvisioner;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _tokens = tokens;
    }

    public async Task<Result<ActivateLicenseResponse>> Handle(ActivateLicenseCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.validation", message, ErrorType.Validation));
        }

        var verified = _artifactVerifier.Verify(command.ActivationCode, command.LicenseArtifact);
        if (verified.IsFailure)
        {
            return Result.Failure<ActivateLicenseResponse>(verified.Error!);
        }

        var payload = verified.Value!;
        var existing = await _redemptions.GetByIdAsync(payload.GrantId, ct).ConfigureAwait(false);
        if (existing is not null)
        {
            return await LoginExistingSubscriptionAsync(existing.SubscriptionAccountId, payload.Provisioning, ct)
                .ConfigureAwait(false);
        }

        if (payload.SupersedesGrantId is { } previousGrantId)
        {
            var previousRedemption = await _redemptions.GetByIdAsync(previousGrantId, ct).ConfigureAwait(false);
            if (previousRedemption is not null)
            {
                return await ReplaceSubscriptionLicenseAsync(previousRedemption, payload, ct).ConfigureAwait(false);
            }
        }

        return await ProvisionSubscriptionAccountAsync(payload, ct).ConfigureAwait(false);
    }

    private async Task<Result<ActivateLicenseResponse>> ReplaceSubscriptionLicenseAsync(
        LicenseRedemption previousRedemption,
        LicenseArtifactPayload payload,
        CancellationToken ct)
    {
        var account = await _subscriptionAccounts.GetByIdForUpdateAsync(previousRedemption.SubscriptionAccountId, ct)
            .ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        if (!_passwordHasher.Verify(payload.Provisioning.OwnerPassword, account.PasswordHash))
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.credentials.invalid", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(payload.PlanLabel, payload.MaxUsers, payload.MaxWarehouses);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.plan.invalid", ex.Message, ErrorType.Validation));
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
            return Result.Failure<ActivateLicenseResponse>(replaced.Error!);
        }

        var companies = await _tenants
            .ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        var activePermissions = await _permissions
            .ListNonDeletedOrderedByCodeAsync(ct)
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
                return Result.Failure<ActivateLicenseResponse>(applied.Error!);
            }

            var roles = await _roles.ListActiveByTenantAsync(company.Id, ct).ConfigureAwait(false);
            foreach (var role in roles.Where(r => r.IsSystem))
            {
                var existingIds = await _rolePermissions
                    .ListPermissionIdsByRoleAsync(company.Id, role.Id, ct)
                    .ConfigureAwait(false);
                var existingSet = new HashSet<Guid>(existingIds);

                foreach (var permission in activePermissions)
                {
                    if (permission.Status != PermissionStatus.Active || existingSet.Contains(permission.Id))
                    {
                        continue;
                    }

                    if (!ModulePermissionFilter.IsPermittedForModules(
                            permission.Code,
                            payload.EnabledModuleCodes,
                            payload.ModuleEntitlements))
                    {
                        continue;
                    }

                    var link = RolePermission.Link(role.Id, permission.Id);
                    if (link.IsSuccess)
                    {
                        await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
                        existingSet.Add(permission.Id);
                    }
                }
            }

            await _warehouseProvisioner.StageDefaultsForTenantAsync(company, ct).ConfigureAwait(false);
        }

        var redemption = LicenseRedemption.Create(payload.GrantId, account.Id, utcNow);
        if (redemption.IsFailure)
        {
            return Result.Failure<ActivateLicenseResponse>(redemption.Error!);
        }

        account.TouchLastLogin(utcNow);
        await _redemptions.AddAsync(redemption.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.CreateForSubscriptionAccount(account.Id);
        return Result.Success(new ActivateLicenseResponse(
            jwt.Token,
            jwt.ExpiresAt,
            account.Id,
            null,
            true));
    }

    private async Task<Result<ActivateLicenseResponse>> LoginExistingSubscriptionAsync(
        Guid subscriptionAccountId,
        LicenseArtifactProvisioning provisioning,
        CancellationToken ct)
    {
        var account = await _subscriptionAccounts.GetByIdForUpdateAsync(subscriptionAccountId, ct)
            .ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        if (!_passwordHasher.Verify(provisioning.OwnerPassword, account.PasswordHash))
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.credentials.invalid", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        account.TouchLastLogin(DateTimeOffset.UtcNow);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.CreateForSubscriptionAccount(account.Id);
        return Result.Success(new ActivateLicenseResponse(
            jwt.Token,
            jwt.ExpiresAt,
            account.Id,
            null,
            true));
    }

    private async Task<Result<ActivateLicenseResponse>> ProvisionSubscriptionAccountAsync(
        LicenseArtifactPayload payload,
        CancellationToken ct)
    {
        var provisioning = payload.Provisioning;
        Email email;
        try
        {
            email = new Email(provisioning.OwnerEmail);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.owner.email_invalid", ex.Message, ErrorType.Validation));
        }

        if (await _subscriptionAccounts.EmailExistsAsync(email.Value, ct).ConfigureAwait(false))
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error(
                    "activate.owner.email_duplicate",
                    "Ya existe una organización con este correo. Inicia sesión como titular o emite la licencia con otro correo.",
                    ErrorType.Conflict));
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(payload.PlanLabel, payload.MaxUsers, payload.MaxWarehouses);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<ActivateLicenseResponse>(
                new Error("activate.plan.invalid", ex.Message, ErrorType.Validation));
        }

        var accountId = _idGenerator.NewId();
        var passwordHash = _passwordHasher.Hash(provisioning.OwnerPassword);
        var utcNow = DateTimeOffset.UtcNow;
        var accountCreated = SubscriptionAccount.Create(
            accountId,
            payload.GrantId,
            email,
            provisioning.OwnerName,
            passwordHash,
            plan,
            payload.MaxTenants,
            payload.EnabledModuleCodes,
            payload.ModuleEntitlements,
            payload.ExpiresAtUtc,
            payload.OnlineValidationIntervalDays,
            utcNow,
            provisioning.OwnerDepartment,
            provisioning.OwnerPhone,
            provisioning.OwnerJobTitle);
        if (accountCreated.IsFailure)
        {
            return Result.Failure<ActivateLicenseResponse>(accountCreated.Error!);
        }

        var redemption = LicenseRedemption.Create(payload.GrantId, accountId, utcNow);
        if (redemption.IsFailure)
        {
            return Result.Failure<ActivateLicenseResponse>(redemption.Error!);
        }

        var account = accountCreated.Value!;
        account.TouchLastLogin(utcNow);

        await _subscriptionAccounts.AddAsync(account, ct).ConfigureAwait(false);
        await _redemptions.AddAsync(redemption.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.CreateForSubscriptionAccount(accountId);
        return Result.Success(new ActivateLicenseResponse(
            jwt.Token,
            jwt.ExpiresAt,
            accountId,
            null,
            true));
    }
}
