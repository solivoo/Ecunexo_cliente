using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EcuNexo.Business.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EcuNexo.Api.Security;

public sealed class JwtAccessTokenFactory : IJwtAccessTokenFactory
{
    private readonly JwtOptions _options;

    public JwtAccessTokenFactory(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public JwtAccessToken Create(Guid userId, Guid tenantId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString("D")),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("D")),
            new(JwtClaimTypes.TenantId, tenantId.ToString("D")),
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return new JwtAccessToken(tokenString, new DateTimeOffset(token.ValidTo.ToUniversalTime()));
    }

    public JwtAccessToken CreateForSubscriptionAccount(Guid subscriptionAccountId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subscriptionAccountId.ToString("D")),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("D")),
            new(JwtClaimTypes.PrincipalKind, JwtClaimTypes.SubscriptionPrincipal),
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return new JwtAccessToken(tokenString, new DateTimeOffset(token.ValidTo.ToUniversalTime()));
    }
}
