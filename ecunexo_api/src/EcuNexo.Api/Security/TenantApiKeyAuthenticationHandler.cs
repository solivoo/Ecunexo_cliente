using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Encodings.Web;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.ApiKeys;
using EcuNexo.Core.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Security;

public static class TenantApiKeyAuthenticationDefaults
{
    public const string AuthenticationScheme = "TenantApiKey";
    public const string HeaderName = "X-Api-Key";
    public const string CompositeScheme = "EcuNexoComposite";

    public static string GetCacheKey(string keyPrefix) => $"tenant_api_key:{keyPrefix}";
}

public sealed class TenantApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ITenantApiKeyRepository apiKeyRepository,
    IMemoryCache memoryCache)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan TouchThrottleWindow = TimeSpan.FromMinutes(2);

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var rawToken = ExtractRawApiKey(Request);
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return AuthenticateResult.NoResult();
        }

        if (!TenantApiKeyCrypto.TryExtractPrefix(rawToken, out var keyPrefix, out var trimmedKey))
        {
            return AuthenticateResult.Fail("Formato de X-Api-Key inválido.");
        }

        var cacheKey = TenantApiKeyAuthenticationDefaults.GetCacheKey(keyPrefix);
        if (!memoryCache.TryGetValue(cacheKey, out TenantApiKey? apiKey))
        {
            apiKey = await apiKeyRepository
                .GetByPrefixUnfilteredAsync(keyPrefix, Context.RequestAborted)
                .ConfigureAwait(false);

            if (apiKey is not null)
            {
                memoryCache.Set(cacheKey, apiKey, CacheDuration);
            }
        }

        var utcNow = DateTimeOffset.UtcNow;
        if (apiKey is null || !apiKey.IsActive(utcNow))
        {
            return AuthenticateResult.Fail("La API Key no existe, expiró o fue revocada.");
        }

        if (!TenantApiKeyCrypto.VerifyFixedTime(trimmedKey, apiKey.KeyHash))
        {
            return AuthenticateResult.Fail("Credencial X-Api-Key inválida.");
        }

        if (!apiKey.LastUsedAt.HasValue || utcNow - apiKey.LastUsedAt.Value >= TouchThrottleWindow)
        {
            try
            {
                await apiKeyRepository
                    .TouchLastUsedAsync(apiKey.TenantId, apiKey.Id, utcNow, Context.RequestAborted)
                    .ConfigureAwait(false);
                apiKey.TouchLastUsed(utcNow);
                memoryCache.Set(cacheKey, apiKey, CacheDuration);
            }
            catch
            {
                // No bloquear peticiones de lectura si la actualización de auditoría falla transitoriamente.
            }
        }

        var claims = new List<Claim>(apiKey.Scopes.Count + 4)
        {
            new(JwtRegisteredClaimNames.Sub, (apiKey.CreatedBy ?? apiKey.Id).ToString("D")),
            new(JwtClaimTypes.PrincipalKind, JwtClaimTypes.ApiKeyPrincipal),
            new(JwtClaimTypes.ApiKeyId, apiKey.Id.ToString("D")),
            new(JwtClaimTypes.TenantId, apiKey.TenantId.ToString("D")),
        };

        foreach (var scope in apiKey.Scopes)
        {
            claims.Add(new Claim(JwtClaimTypes.ApiKeyScope, scope));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }

    private static string? ExtractRawApiKey(HttpRequest request)
    {
        if (request.Headers.TryGetValue(TenantApiKeyAuthenticationDefaults.HeaderName, out var headerValues))
        {
            var first = headerValues.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(first))
            {
                return first;
            }
        }

        if (request.Headers.TryGetValue("Authorization", out var authValues))
        {
            var auth = authValues.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(auth)
                && auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var token = auth["Bearer ".Length..].Trim();
                if (token.StartsWith(TenantApiKeyCrypto.TokenHeaderPrefix, StringComparison.Ordinal))
                {
                    return token;
                }
            }
        }

        return null;
    }
}
