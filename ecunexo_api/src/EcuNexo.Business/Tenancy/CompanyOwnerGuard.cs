using EcuNexo.Business.Identity;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy;

/// <summary>
/// Identifica al administrador raíz de la empresa: usuario cuyo correo coincide con el titular de la suscripción.
/// </summary>
public interface ICompanyOwnerGuard
{
    Task<bool> IsCompanyOwnerAsync(Guid tenantId, Guid userId, CancellationToken ct);

    /// <summary>Falla si el usuario es el admin raíz (no se le pueden quitar/cambiar roles).</summary>
    Task<Result> EnsureCanChangeRolesAsync(Guid tenantId, Guid userId, CancellationToken ct);
}

public sealed class CompanyOwnerGuard : ICompanyOwnerGuard
{
    private readonly ITenantRepository _tenants;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly IUserRepository _users;

    public CompanyOwnerGuard(
        ITenantRepository tenants,
        ISubscriptionAccountRepository accounts,
        IUserRepository users)
    {
        _tenants = tenants;
        _accounts = accounts;
        _users = users;
    }

    public async Task<bool> IsCompanyOwnerAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return false;
        }

        var account = await _accounts
            .GetBySubscriptionGroupIdAsync(tenant.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        if (account is null)
        {
            return false;
        }

        var user = await _users.GetActiveByIdAsync(tenantId, userId, ct).ConfigureAwait(false);
        if (user is null)
        {
            return false;
        }

        return string.Equals(user.Email.Value, account.Email, StringComparison.OrdinalIgnoreCase);
    }

    public async Task<Result> EnsureCanChangeRolesAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        if (!await IsCompanyOwnerAsync(tenantId, userId, ct).ConfigureAwait(false))
        {
            return Result.Success();
        }

        return Result.Failure(
            new Error(
                "user_role.company_owner.locked",
                "No se puede cambiar el rol del administrador raíz de la empresa (correo del titular).",
                ErrorType.Forbidden));
    }
}
