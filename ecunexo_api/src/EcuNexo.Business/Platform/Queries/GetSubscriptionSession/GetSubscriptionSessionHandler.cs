using System.Security.Cryptography;
using System.Text;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Navigation;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Platform.Navigation;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Platform.Queries.GetSubscriptionSession;

public sealed class GetSubscriptionSessionHandler : IQueryHandler<GetSubscriptionSessionQuery, SubscriptionSessionResponse>
{
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ISettingsResolver _settings;
    private readonly IMenuNavigationBuilder _navigation;

    public GetSubscriptionSessionHandler(
        ISubscriptionAccountRepository accounts,
        ISettingsResolver settings,
        IMenuNavigationBuilder navigation)
    {
        _accounts = accounts;
        _settings = settings;
        _navigation = navigation;
    }

    public async Task<Result<SubscriptionSessionResponse>> Handle(
        GetSubscriptionSessionQuery query,
        CancellationToken ct)
    {
        var account = await _accounts.GetByIdAsync(query.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<SubscriptionSessionResponse>(
                new Error("session.subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var codes = SubscriptionAccountPermissions.All;
        var enabledModules = account.EnabledModuleCodes is null
            ? null
            : (IReadOnlyList<string>?)account.EnabledModuleCodes.AsReadOnly();

        var settings = await _settings
            .ResolveAsync(Guid.Empty, account.Id, account.ServicePlan.Name, ct)
            .ConfigureAwait(false);

        var menu = await _navigation
            .BuildAsync(MenuContextKind.Subscription, codes, enabledModules, ct)
            .ConfigureAwait(false);

        var permVersion = ComputePermVersion(codes);

        var (entitlements, resolvedLimits) = GetSession.SessionLimitResolver.Resolve(account.ModuleEntitlements);

        return Result.Success(new SubscriptionSessionResponse(
            new GetSession.SessionUserDto(
                account.Id,
                account.Email,
                account.Name,
                account.Department,
                account.Phone,
                account.JobTitle,
                []),
            new SubscriptionAccountSessionDto(
                account.Id,
                account.ServicePlan.Name,
                account.ServicePlan.MaxUsers,
                account.ServicePlan.MaxWarehouses,
                account.SubscriptionMaxTenants,
                enabledModules,
                entitlements,
                resolvedLimits),
            codes,
            settings,
            menu.Items,
            menu.AvailableContexts,
            permVersion,
            true));
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
