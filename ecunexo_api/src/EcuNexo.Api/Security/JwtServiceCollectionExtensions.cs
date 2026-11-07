using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace EcuNexo.Api.Security;

public static class JwtServiceCollectionExtensions
{
    public static IServiceCollection AddEcuNexoJwt(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(j => !string.IsNullOrWhiteSpace(j.Issuer), "Jwt:Issuer es obligatorio.")
            .Validate(j => !string.IsNullOrWhiteSpace(j.Audience), "Jwt:Audience es obligatorio.")
            .Validate(
                j => j.SigningKey is { Length: >= 32 },
                "Jwt:SigningKey debe tener al menos 32 caracteres (HMAC-SHA256).")
            .ValidateOnStart();

        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException($"La sección «{JwtOptions.SectionName}» no está configurada.");

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TenantApiKeyAuthenticationDefaults.CompositeScheme;
                options.DefaultChallengeScheme = TenantApiKeyAuthenticationDefaults.CompositeScheme;
            })
            .AddPolicyScheme(TenantApiKeyAuthenticationDefaults.CompositeScheme, "JWT or Tenant API Key", options =>
            {
                options.ForwardDefaultSelector = static context =>
                {
                    if (context.Request.Headers.ContainsKey(TenantApiKeyAuthenticationDefaults.HeaderName))
                    {
                        return TenantApiKeyAuthenticationDefaults.AuthenticationScheme;
                    }

                    if (context.Request.Headers.TryGetValue("Authorization", out var auth)
                        && auth.FirstOrDefault() is { } raw
                        && raw.StartsWith("Bearer ecx_live_", StringComparison.OrdinalIgnoreCase))
                    {
                        return TenantApiKeyAuthenticationDefaults.AuthenticationScheme;
                    }

                    return JwtBearerDefaults.AuthenticationScheme;
                };
            })
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TenantApiKeyAuthenticationHandler>(
                TenantApiKeyAuthenticationDefaults.AuthenticationScheme,
                static _ => { })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
            });

        services.AddAuthorization();
        return services;
    }
}
