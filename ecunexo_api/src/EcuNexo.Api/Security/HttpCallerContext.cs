using EcuNexo.Business.Abstractions;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace EcuNexo.Api.Security;

/// <summary>
/// Identidad del llamante: primero JWT (<c>sub</c>, <see cref="JwtClaimTypes.TenantId"/>); si no hay usuario autenticado, cabeceras <c>X-EcuNexo-*</c> (compatibilidad local).
/// </summary>
public sealed class HttpCallerContext(IHttpContextAccessor httpContextAccessor) : ICallerContext
{
    private const string UserIdHeader = "X-EcuNexo-User-Id";
    private const string TenantIdHeader = "X-EcuNexo-Tenant-Id";

    public Guid? UserId
    {
        get
        {
            var http = httpContextAccessor.HttpContext;
            if (http?.User.Identity?.IsAuthenticated == true)
            {
                var sub = http.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                    ?? http.User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (sub is not null && Guid.TryParse(sub, out var id))
                {
                    return id;
                }
            }

            return ParseGuid(http?.Request, UserIdHeader);
        }
    }

    public Guid? ExplicitTenantId
    {
        get
        {
            var http = httpContextAccessor.HttpContext;
            if (http?.User.Identity?.IsAuthenticated == true)
            {
                var tid = http.User.FindFirstValue(JwtClaimTypes.TenantId);
                if (tid is not null && Guid.TryParse(tid, out var id))
                {
                    return id;
                }
            }

            return ParseGuid(http?.Request, TenantIdHeader);
        }
    }

    public bool IsSubscriptionHolder
    {
        get
        {
            var http = httpContextAccessor.HttpContext;
            if (http?.User.Identity?.IsAuthenticated == true)
            {
                return string.Equals(
                    http.User.FindFirstValue(JwtClaimTypes.PrincipalKind),
                    JwtClaimTypes.SubscriptionPrincipal,
                    StringComparison.Ordinal);
            }

            return false;
        }
    }

    private static Guid? ParseGuid(HttpRequest? request, string headerName)
    {
        if (request?.Headers.TryGetValue(headerName, out var values) == true &&
            Guid.TryParse(values.FirstOrDefault(), out var id))
        {
            return id;
        }

        return null;
    }
}
