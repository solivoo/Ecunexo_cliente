using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Identity.Queries.ListPermissions;

public sealed class ListPermissionsHandler(
    EcuNexo.Business.Identity.IPermissionRepository permissions,
    ICallerContext? caller = null,
    ITenantContext? tenantContext = null,
    ITenantRepository? tenants = null,
    ISubscriptionAccountRepository? accounts = null)
    : IQueryHandler<ListPermissionsQuery, IReadOnlyList<PermissionListItemResponse>>
{
    public async Task<Result<IReadOnlyList<PermissionListItemResponse>>> Handle(
        ListPermissionsQuery query,
        CancellationToken ct)
    {
        _ = query;
        var list = await permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false);

        IReadOnlyList<string>? enabledModules = null;
        IReadOnlyList<ModuleEntitlement>? moduleEntitlements = null;
        var hasLicenseScope = false;

        var effectiveTenantId = tenantContext?.CurrentTenantId ?? caller?.ExplicitTenantId;
        if (effectiveTenantId is { } tenantId && tenantId != Guid.Empty && tenants is not null)
        {
            var tenant = await tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
            if (tenant is not null)
            {
                enabledModules = tenant.EnabledModuleCodes;
                moduleEntitlements = tenant.ModuleEntitlements;
                hasLicenseScope = true;
            }
        }
        else if (caller is { IsSubscriptionHolder: true, UserId: { } accountId } && accounts is not null)
        {
            var account = await accounts.GetByIdAsync(accountId, ct).ConfigureAwait(false);
            if (account is not null)
            {
                enabledModules = account.EnabledModuleCodes;
                moduleEntitlements = account.ModuleEntitlements;
                hasLicenseScope = true;
            }
        }

        var filtered = hasLicenseScope
            ? list.Where(p => ModulePermissionFilter.IsPermittedForModules(p.Code, enabledModules, moduleEntitlements))
            : list;

        IReadOnlyList<PermissionListItemResponse> mapped = filtered.Select(
                p => new PermissionListItemResponse(
                    p.Id,
                    p.Code,
                    p.DisplayName,
                    p.Module,
                    p.SortOrder,
                    p.Description,
                    p.Status,
                    p.CreatedAt))
            .ToList();

        return Result.Success(mapped);
    }
}
