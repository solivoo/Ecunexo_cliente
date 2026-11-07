using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.ApiKeys.Queries.ListDeveloperApiScopes;

public sealed record ListDeveloperApiScopesQuery(Guid TenantId) : IQuery<IReadOnlyList<DeveloperApiScopeItemDto>>;

public sealed class ListDeveloperApiScopesHandler(
    ITenantRepository tenants) : IQueryHandler<ListDeveloperApiScopesQuery, IReadOnlyList<DeveloperApiScopeItemDto>>
{
    public async Task<Result<IReadOnlyList<DeveloperApiScopeItemDto>>> Handle(
        ListDeveloperApiScopesQuery query,
        CancellationToken ct)
    {
        var tenant = await tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<IReadOnlyList<DeveloperApiScopeItemDto>>(
                new Error("tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var items = DeveloperApiScopes.All
            .Select(s =>
            {
                var entitled = ModulePermissionFilter.IsModuleEnabled(
                    s.ModuleCode,
                    tenant.EnabledModuleCodes,
                    tenant.ModuleEntitlements);

                return new DeveloperApiScopeItemDto(
                    s.Code,
                    s.ModuleCode,
                    s.ModuleLabel,
                    s.Title,
                    s.Description,
                    entitled);
            })
            .ToList();

        return Result.Success<IReadOnlyList<DeveloperApiScopeItemDto>>(items);
    }
}
