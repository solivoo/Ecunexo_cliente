namespace EcuNexo.Business.Identity.Commands.Login;

public sealed record LoginResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    Guid UserId,
    Guid? TenantId,
    bool IsSubscriptionHolder);
