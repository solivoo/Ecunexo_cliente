namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Emite tokens JWT de acceso para la API (implementación en <c>EcuNexo.Api</c>).
/// </summary>
public interface IJwtAccessTokenFactory
{
    JwtAccessToken Create(Guid userId, Guid tenantId);

    JwtAccessToken CreateForSubscriptionAccount(Guid subscriptionAccountId);
}

public sealed record JwtAccessToken(string Token, DateTimeOffset ExpiresAt);
