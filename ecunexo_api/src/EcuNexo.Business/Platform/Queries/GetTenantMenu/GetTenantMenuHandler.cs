using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Platform.Navigation;
using EcuNexo.Business.Platform.Queries.GetSession;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Business.Platform.Queries.GetTenantMenu;

public sealed record GetTenantMenuQuery(Guid TenantId, Guid UserId, MenuContextKind Context)
    : IQuery<TenantMenuResponse>;

public sealed record TenantMenuResponse(
    IReadOnlyList<NavigationNodeDto> Items,
    IReadOnlyList<string> AvailableContexts,
    string Context);

public sealed class GetTenantMenuHandler : IQueryHandler<GetTenantMenuQuery, TenantMenuResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IUserPermissionQuery _permissions;
    private readonly IMenuNavigationBuilder _navigation;

    public GetTenantMenuHandler(
        ITenantRepository tenants,
        IUserRepository users,
        IUserPermissionQuery permissions,
        IMenuNavigationBuilder navigation)
    {
        _tenants = tenants;
        _users = users;
        _permissions = permissions;
        _navigation = navigation;
    }

    public async Task<Result<TenantMenuResponse>> Handle(GetTenantMenuQuery query, CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<TenantMenuResponse>(
                new Error("menu.tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var user = await _users.GetActiveByIdAsync(query.TenantId, query.UserId, ct).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<TenantMenuResponse>(
                new Error("menu.user.not_found", "El usuario no existe en esta organización.", ErrorType.NotFound));
        }

        var codes = await _permissions.ListEffectivePermissionCodesAsync(query.TenantId, query.UserId, ct)
            .ConfigureAwait(false);

        var enabledModules = tenant.EnabledModuleCodes is null
            ? null
            : (IReadOnlyList<string>?)tenant.EnabledModuleCodes.AsReadOnly();

        var menu = await _navigation
            .BuildAsync(query.Context, codes, enabledModules, ct)
            .ConfigureAwait(false);

        return Result.Success(new TenantMenuResponse(
            menu.Items,
            menu.AvailableContexts,
            query.Context.ToString().ToLowerInvariant()));
    }
}
