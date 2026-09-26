namespace EcuNexo.Api.Security;

/// <summary>Políticas de rate limiting para el checkout y catálogo públicos.</summary>
public static class StorefrontRateLimitPolicies
{
    public const string Orders = "storefront-orders";
    public const string Read = "storefront-read";

    public const int OrdersPermitLimit = 5;
    public const int OrdersWindowMinutes = 10;
    public const int ReadPermitLimit = 120;
    public const int ReadWindowMinutes = 1;

    public const string RateLimitedErrorCode = "ecommerce.checkout.rate_limited";

    /// <summary>
    /// Resuelve la IP real del comprador: <c>CF-Connecting-IP</c>, primer <c>X-Forwarded-For</c> o la conexión directa.
    /// </summary>
    public static string ResolveClientIp(HttpContext httpContext)
    {
        var cloudflareIp = httpContext.Request.Headers["CF-Connecting-IP"].ToString();
        if (!string.IsNullOrWhiteSpace(cloudflareIp))
        {
            return cloudflareIp.Trim();
        }

        var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            var first = forwardedFor.Split(',')[0].Trim();
            if (first.Length > 0)
            {
                return first;
            }
        }

        return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
