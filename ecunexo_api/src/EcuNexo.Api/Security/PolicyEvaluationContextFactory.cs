using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.PolicyEvaluation;

namespace EcuNexo.Api.Security;

/// <summary>
/// Construye el contexto pasado al evaluador ABAC a partir de la petición HTTP.
/// </summary>
public static class PolicyEvaluationContextFactory
{
    private const string ResourceIdHeader = "X-EcuNexo-Resource-Id";

    public static PolicyEvaluationContext Create(HttpContext http, ICallerContext caller, ITenantContext tenant)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        Guid? resourceId = ResolveResourceId(http);
        return new PolicyEvaluationContext(
            caller.UserId,
            tenantId,
            resourceId,
            DateTimeOffset.UtcNow);
    }

    public static async Task<PolicyEvaluationContext> CreateAsync(
        HttpContext http,
        ICallerContext caller,
        ITenantContext tenant,
        IUserRepository users,
        CancellationToken ct)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        Guid? resourceId = ResolveResourceId(http);
        string? department = null;
        string? jobTitle = null;

        if (caller.UserId is { } userId && tenantId is { } tid)
        {
            var user = await users.GetActiveByIdAsync(tid, userId, ct).ConfigureAwait(false);
            if (user is not null)
            {
                department = user.Department;
                jobTitle = user.JobTitle;
            }
        }

        return new PolicyEvaluationContext(
            caller.UserId,
            tenantId,
            resourceId,
            DateTimeOffset.UtcNow,
            department,
            jobTitle);
    }

    private static Guid? ResolveResourceId(HttpContext http)
    {
        if (http.GetRouteValue("resourceId") is string rs && Guid.TryParse(rs, out var fromRoute))
        {
            return fromRoute;
        }

        if (http.Request.Headers.TryGetValue(ResourceIdHeader, out var header) &&
            Guid.TryParse(header.FirstOrDefault(), out var fromHeader))
        {
            return fromHeader;
        }

        return null;
    }
}
