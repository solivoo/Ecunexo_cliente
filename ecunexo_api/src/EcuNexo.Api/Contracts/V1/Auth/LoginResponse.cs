namespace EcuNexo.Api.Contracts.V1.Auth;

public sealed record LoginResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    Guid UserId,
    Guid? TenantId,
    bool IsSubscriptionHolder);
