using EcuNexo.Api.Configuration;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Authorization;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Security;

/// <summary>
/// Permite llamada servicio-a-servicio con API key o JWT con inventory.documents.approve.
/// </summary>
public sealed class InventoryEgressAccessFilter : IEndpointFilter
{
    public const string ApiKeyHeaderName = "X-EcuNexo-Inventory-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var opts = http.RequestServices.GetRequiredService<IOptions<InventoryEgressOptions>>().Value;
        var providedKey = http.Request.Headers[ApiKeyHeaderName].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(opts.ApiKey)
            && !string.IsNullOrWhiteSpace(providedKey)
            && string.Equals(opts.ApiKey, providedKey, StringComparison.Ordinal))
        {
            return await next(context).ConfigureAwait(false);
        }

        if (http.User.Identity?.IsAuthenticated != true)
        {
            return Results.Unauthorized();
        }

        var guard = http.RequestServices.GetRequiredService<IPermissionAccessGuard>();
        var caller = http.RequestServices.GetRequiredService<ICallerContext>();
        var tenantContext = http.RequestServices.GetRequiredService<ITenantContext>();
        var evaluation = PolicyEvaluationContextFactory.Create(http, caller, tenantContext);
        var result = await guard
            .RequireAsync("inventory.documents.approve", evaluation, http.RequestAborted)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return await next(context).ConfigureAwait(false);
    }
}
