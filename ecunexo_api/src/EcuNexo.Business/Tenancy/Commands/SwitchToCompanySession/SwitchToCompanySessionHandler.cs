using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Commands.SwitchToCompanySession;

/// <summary>
/// Emite JWT de tenant para el titular que entra a una empresa de su suscripción.
/// </summary>
public sealed class SwitchToCompanySessionHandler : ICommandHandler<SwitchToCompanySessionCommand, SwitchToCompanySessionResponse>
{
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IRoleRepository _roles;
    private readonly IUserRoleRepository _userRoles;
    private readonly IJwtAccessTokenFactory _tokens;
    private readonly IUnitOfWork _unitOfWork;

    public SwitchToCompanySessionHandler(
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants,
        IUserRepository users,
        IRoleRepository roles,
        IUserRoleRepository userRoles,
        IJwtAccessTokenFactory tokens,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _tenants = tenants;
        _users = users;
        _roles = roles;
        _userRoles = userRoles;
        _tokens = tokens;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SwitchToCompanySessionResponse>> Handle(
        SwitchToCompanySessionCommand command,
        CancellationToken ct)
    {
        var account = await _accounts.GetByIdAsync(command.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        if (tenant.SubscriptionGroupId != account.SubscriptionGroupId)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error("company.access.denied", "La empresa no pertenece a tu licencia.", ErrorType.Forbidden));
        }

        if (tenant.Status is TenantStatus.Suspended or TenantStatus.Cancelled)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error("tenant.inactive", "La empresa no está disponible.", ErrorType.Forbidden));
        }

        Email email;
        try
        {
            email = new Email(account.Email);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error("subscription.email.invalid", ex.Message, ErrorType.Validation));
        }

        var user = await _users.GetActiveByEmailForUpdateAsync(tenant.Id, email, ct).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error(
                    "company.user.not_linked",
                    "No hay un usuario activo en esta empresa con el correo del titular. Inicia sesión con las credenciales del administrador de la empresa.",
                    ErrorType.NotFound));
        }

        if (user.IsDisabled)
        {
            return Result.Failure<SwitchToCompanySessionResponse>(
                new Error(
                    "company.user.disabled",
                    "El usuario administrador de esta empresa está deshabilitado.",
                    ErrorType.Forbidden));
        }

        var roleIds = await _userRoles.ListRoleIdsForUserAsync(tenant.Id, user.Id, ct).ConfigureAwait(false);
        if (roleIds.Count == 0)
        {
            var healed = await EnsureHolderHasAdminRoleAsync(tenant.Id, user.Id, ct).ConfigureAwait(false);
            if (healed.IsFailure)
            {
                return Result.Failure<SwitchToCompanySessionResponse>(healed.Error!);
            }
        }

        var utcNow = DateTimeOffset.UtcNow;
        user.TouchLastLogin(utcNow);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        var jwt = _tokens.Create(user.Id, tenant.Id);
        return Result.Success(new SwitchToCompanySessionResponse(
            jwt.Token,
            jwt.ExpiresAt,
            user.Id,
            tenant.Id,
            false));
    }

    /// <summary>
    /// Si el titular quedó sin roles (p. ej. sync vacío en Editar usuario), reasigna el Administrador de sistema.
    /// </summary>
    private async Task<Result> EnsureHolderHasAdminRoleAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        var roles = await _roles.ListActiveByTenantAsync(tenantId, ct).ConfigureAwait(false);
        var admin = roles.FirstOrDefault(r => r.IsSystem)
            ?? roles.FirstOrDefault(r =>
                string.Equals(r.Name, "Administrador", StringComparison.OrdinalIgnoreCase));
        if (admin is null)
        {
            return Result.Failure(
                new Error(
                    "company.admin_role.missing",
                    "Esta empresa no tiene rol Administrador. Créalo y asígnale permisos antes de entrar.",
                    ErrorType.NotFound));
        }

        var assign = UserRole.Assign(tenantId, userId, admin.Id);
        if (assign.IsFailure)
        {
            return Result.Failure(assign.Error!);
        }

        await _userRoles.AddAsync(assign.Value!, ct).ConfigureAwait(false);
        return Result.Success();
    }
}
