using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Authorization;
using EcuNexo.Core.Common;

namespace EcuNexo.Api.Security;

public static class PermissionFilters
{
    public static IEndpointFilter Require(string permissionCode) =>
        new RequirePermissionEndpointFilter(permissionCode);

    public static IEndpointFilter RequireAny(params string[] permissionCodes) =>
        new RequireAnyPermissionEndpointFilter(permissionCodes);
}

internal sealed class RequirePermissionEndpointFilter(string permissionCode) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var guard = http.RequestServices.GetRequiredService<IPermissionAccessGuard>();
        var caller = http.RequestServices.GetRequiredService<ICallerContext>();
        var tenantContext = http.RequestServices.GetRequiredService<ITenantContext>();
        var evaluation = PolicyEvaluationContextFactory.Create(http, caller, tenantContext);
        var result = await guard.RequireAsync(permissionCode, evaluation, http.RequestAborted)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return await next(context).ConfigureAwait(false);
    }
}

internal sealed class RequireAnyPermissionEndpointFilter(string[] permissionCodes) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var guard = http.RequestServices.GetRequiredService<IPermissionAccessGuard>();
        var caller = http.RequestServices.GetRequiredService<ICallerContext>();
        var tenantContext = http.RequestServices.GetRequiredService<ITenantContext>();
        var evaluation = PolicyEvaluationContextFactory.Create(http, caller, tenantContext);

        Result? lastFailure = null;
        foreach (var code in permissionCodes)
        {
            var result = await guard.RequireAsync(code, evaluation, http.RequestAborted)
                .ConfigureAwait(false);
            if (result.IsSuccess)
            {
                return await next(context).ConfigureAwait(false);
            }

            lastFailure = result;
        }

        if (lastFailure is { } failure)
        {
            return failure.ToHttpResult();
        }

        return Results.Forbid();
    }
}
