namespace EcuNexo.Api.Contracts.V1.Auth;

public sealed record DevTokenResponse(string AccessToken, DateTimeOffset ExpiresAtUtc);
