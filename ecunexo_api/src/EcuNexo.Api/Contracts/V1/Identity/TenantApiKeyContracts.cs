namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record CreateTenantApiKeyRequest(
    string Name,
    IReadOnlyList<string> Scopes,
    DateTimeOffset? ExpiresAt);
