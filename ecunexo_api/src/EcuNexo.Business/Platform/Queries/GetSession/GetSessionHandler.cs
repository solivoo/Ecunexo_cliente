using System.Security.Cryptography;
using System.Text;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Platform.Navigation;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Business.Platform.Queries.GetSession;

public sealed class GetSessionHandler : IQueryHandler<GetSessionQuery, SessionResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IUserRoleRepository _userRoles;
    private readonly IUserPermissionQuery _permissions;
    private readonly ISettingsResolver _settings;
    private readonly IMenuNavigationBuilder _navigation;

    public GetSessionHandler(
        ITenantRepository tenants,
        IUserRepository users,
        IUserRoleRepository userRoles,
        IUserPermissionQuery permissions,
        ISettingsResolver settings,
        IMenuNavigationBuilder navigation)
    {
        _tenants = tenants;
        _users = users;
        _userRoles = userRoles;
        _permissions = permissions;
        _settings = settings;
        _navigation = navigation;
    }

    public async Task<Result<SessionResponse>> Handle(GetSessionQuery query, CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<SessionResponse>(
                new Error("session.tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var user = await _users.GetActiveByIdAsync(query.TenantId, query.UserId, ct).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SessionResponse>(
                new Error("session.user.not_found", "El usuario no existe en esta organización.", ErrorType.NotFound));
        }

        var roleIds = await _userRoles.ListRoleIdsForUserAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);
        var codes = await _permissions.ListEffectivePermissionCodesAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);

        var settings = await _settings.ResolveAsync(query.TenantId, query.UserId, tenant.ServicePlan.Name, ct)
            .ConfigureAwait(false);

        var enabledModules = tenant.EnabledModuleCodes is null
            ? null
            : (IReadOnlyList<string>?)tenant.EnabledModuleCodes.AsReadOnly();

        var menu = await _navigation
            .BuildAsync(MenuContextKind.Operational, codes, enabledModules, ct)
            .ConfigureAwait(false);

        var permVersion = ComputePermVersion(codes);

        var (entitlements, resolvedLimits) = SessionLimitResolver.Resolve(tenant.ModuleEntitlements);

        return Result.Success(new SessionResponse(
            new SessionUserDto(
                user.Id,
                user.Email.Value,
                user.Name,
                user.Department,
                user.Phone,
                user.JobTitle,
                roleIds),
            new SessionTenantDto(
                tenant.Id,
                tenant.Name,
                tenant.TimeZoneId,
                tenant.Locale,
                tenant.LogoUrl,
                tenant.LogoLightId is { } light
                    ? $"/api/v1/tenants/{tenant.Id}/brand-logos/{light}/file"
                    : null,
                tenant.LogoDarkId is { } dark
                    ? $"/api/v1/tenants/{tenant.Id}/brand-logos/{dark}/file"
                    : null,
                tenant.PreferWordmark,
                tenant.PrimaryColorHex,
                tenant.Status,
                tenant.ServicePlan.Name,
                tenant.ServicePlan.MaxUsers,
                tenant.ServicePlan.MaxWarehouses,
                tenant.SubscriptionMaxTenants,
                enabledModules,
                entitlements,
                resolvedLimits),
            codes,
            settings,
            menu.Items,
            menu.AvailableContexts,
            permVersion));
    }

    private static string ComputePermVersion(IReadOnlyList<string> codes)
    {
        if (codes.Count == 0)
        {
            return "0";
        }

        var joined = string.Join('\n', codes.OrderBy(c => c, StringComparer.Ordinal));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(joined));
        return Convert.ToHexString(hash)[..16];
    }
}
