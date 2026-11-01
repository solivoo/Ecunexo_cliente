using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands.Login;

public sealed class LoginHandler : ICommandHandler<LoginCommand, LoginResponse>
{
    private readonly IValidator<LoginCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly ISubscriptionAccountRepository _subscriptionAccounts;
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtAccessTokenFactory _tokens;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILicenseComplianceService _licenseCompliance;
    private readonly ILicenseOnlineValidator _onlineValidator;
    private readonly ILicenseRedemptionRepository _redemptions;
    private readonly IIdGenerator _idGenerator;

    public LoginHandler(
        IValidator<LoginCommand> validator,
        ITenantRepository tenants,
        ISubscriptionAccountRepository subscriptionAccounts,
        IUserRepository users,
        IPasswordHasher passwordHasher,
        IJwtAccessTokenFactory tokens,
        IUnitOfWork unitOfWork,
        ILicenseComplianceService licenseCompliance,
        ILicenseOnlineValidator onlineValidator,
        ILicenseRedemptionRepository redemptions,
        IIdGenerator idGenerator)
    {
        _validator = validator;
        _tenants = tenants;
        _subscriptionAccounts = subscriptionAccounts;
        _users = users;
        _passwordHasher = passwordHasher;
        _tokens = tokens;
        _unitOfWork = unitOfWork;
        _licenseCompliance = licenseCompliance;
        _onlineValidator = onlineValidator;
        _redemptions = redemptions;
        _idGenerator = idGenerator;
    }

    public async Task<Result<LoginResponse>> Handle(LoginCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<LoginResponse>(
                new Error("auth.login.validation", message, ErrorType.Validation));
        }

        Email email;
        try
        {
            email = new Email(command.Email);
        }
        catch (ArgumentException)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        if (command.TenantId is { } explicitTenantId && explicitTenantId != Guid.Empty)
        {
            return await LoginTenantUserAsync(explicitTenantId, email, command.Password, ct).ConfigureAwait(false);
        }

        var subscription = await _subscriptionAccounts.GetByEmailForUpdateAsync(email.Value, ct).ConfigureAwait(false);
        if (subscription is not null)
        {
            return await LoginSubscriptionAccountAsync(subscription, command.Password, ct).ConfigureAwait(false);
        }

        var user = await _users.GetActiveByEmailForLoginAsync(email, ct).ConfigureAwait(false);
        if (user is null)
        {
            return await TryBootstrapCloudSubscriptionAsync(email, command.Password, ct).ConfigureAwait(false);
        }

        return await LoginTenantUserAsync(user.TenantId, email, command.Password, user, ct).ConfigureAwait(false);
    }

    private async Task<Result<LoginResponse>> TryBootstrapCloudSubscriptionAsync(
        Email email,
        string password,
        CancellationToken ct)
    {
        var bootstrap = await _onlineValidator
            .BootstrapCloudSubscriptionAsync(email.Value, password, ct)
            .ConfigureAwait(false);
        if (bootstrap.IsFailure)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        var remote = bootstrap.Value!;
        if (await _redemptions.GetByIdAsync(remote.GrantId, ct).ConfigureAwait(false) is not null)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        ServicePlan plan;
        try
        {
            plan = new ServicePlan(remote.PlanLabel, remote.MaxUsers, remote.MaxWarehouses);
        }
        catch (ArgumentException)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        var accountId = _idGenerator.NewId();
        var passwordHash = _passwordHasher.Hash(password);
        var utcNow = DateTimeOffset.UtcNow;
        var accountCreated = SubscriptionAccount.Create(
            accountId,
            remote.GrantId,
            email,
            string.IsNullOrWhiteSpace(remote.OwnerName) ? "Titular" : remote.OwnerName,
            passwordHash,
            plan,
            remote.MaxTenants,
            remote.EnabledModuleCodes,
            remote.ModuleEntitlements,
            remote.ExpiresAtUtc,
            remote.OnlineValidationIntervalDays,
            utcNow,
            remote.OwnerDepartment,
            remote.OwnerPhone,
            remote.OwnerJobTitle);
        if (accountCreated.IsFailure)
        {
            return Result.Failure<LoginResponse>(accountCreated.Error!);
        }

        var redemption = LicenseRedemption.Create(remote.GrantId, accountId, utcNow);
        if (redemption.IsFailure)
        {
            return Result.Failure<LoginResponse>(redemption.Error!);
        }

        var account = accountCreated.Value!;
        account.TouchLastLogin(utcNow);

        await _subscriptionAccounts.AddAsync(account, ct).ConfigureAwait(false);
        await _redemptions.AddAsync(redemption.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.CreateForSubscriptionAccount(accountId);
        return Result.Success(new LoginResponse(
            jwt.Token,
            jwt.ExpiresAt,
            accountId,
            null,
            true));
    }

    private async Task<Result<LoginResponse>> LoginSubscriptionAccountAsync(
        SubscriptionAccount account,
        string password,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(account.PasswordHash)
            || !_passwordHasher.Verify(password, account.PasswordHash))
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        var compliance = await _licenseCompliance.EnsureCompliantAsync(account, ct).ConfigureAwait(false);
        if (compliance.IsFailure)
        {
            return Result.Failure<LoginResponse>(compliance.Error!);
        }

        var utcNow = DateTimeOffset.UtcNow;
        account.TouchLastLogin(utcNow);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.CreateForSubscriptionAccount(account.Id);
        return Result.Success(new LoginResponse(
            jwt.Token,
            jwt.ExpiresAt,
            account.Id,
            null,
            true));
    }

    private async Task<Result<LoginResponse>> LoginTenantUserAsync(
        Guid tenantId,
        Email email,
        string password,
        CancellationToken ct)
    {
        var user = await _users.GetActiveByEmailForUpdateAsync(tenantId, email, ct).ConfigureAwait(false);
        return await LoginTenantUserAsync(tenantId, email, password, user, ct).ConfigureAwait(false);
    }

    private async Task<Result<LoginResponse>> LoginTenantUserAsync(
        Guid tenantId,
        Email email,
        string password,
        User? user,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        if (tenant.Status is TenantStatus.Suspended or TenantStatus.Cancelled)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.tenant.inactive", "La organización no está disponible.", ErrorType.Forbidden));
        }

        var subscription = await _subscriptionAccounts
            .GetBySubscriptionGroupIdForUpdateAsync(tenant.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        if (subscription is not null)
        {
            var compliance = await _licenseCompliance.EnsureCompliantAsync(subscription, ct).ConfigureAwait(false);
            if (compliance.IsFailure)
            {
                return Result.Failure<LoginResponse>(compliance.Error!);
            }
        }

        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        if (user.IsDisabled)
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.user.disabled", "El usuario está deshabilitado.", ErrorType.Forbidden));
        }

        if (!_passwordHasher.Verify(password, user.PasswordHash))
        {
            return Result.Failure<LoginResponse>(
                new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
        }

        var utcNow = DateTimeOffset.UtcNow;
        user.TouchLastLogin(utcNow);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.Create(user.Id, tenantId);
        return Result.Success(new LoginResponse(
            jwt.Token,
            jwt.ExpiresAt,
            user.Id,
            tenantId,
            false));
    }
}
