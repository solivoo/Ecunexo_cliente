namespace EcuNexo.Business.Identity.ApiKeys;

public sealed record TenantApiKeyItemDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string KeyPrefix,
    IReadOnlyList<string> Scopes,
    DateTimeOffset CreatedAt,
    Guid? CreatedBy,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? RevokedAt,
    DateTimeOffset? LastUsedAt,
    string Status);

public sealed record CreatedTenantApiKeyDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string KeyPrefix,
    string PlainTextKey,
    IReadOnlyList<string> Scopes,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt);

public sealed record DeveloperApiScopeItemDto(
    string Code,
    string ModuleCode,
    string ModuleLabel,
    string Title,
    string Description,
    bool IsModuleEntitled);
