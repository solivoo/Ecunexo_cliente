using EcuNexo.Business.Abstractions;

namespace EcuNexo.Api.Middleware;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext http, ITenantContext tenantContext)
    {
        if (http.GetRouteValue("tenantId") is string s && Guid.TryParse(s, out var tenantId))
        {
            tenantContext.SetCurrentTenant(tenantId);
        }

        await next(http).ConfigureAwait(false);
    }
}
